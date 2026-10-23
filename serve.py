"""Loopback-only investigation service. Python stdlib + existing Node decoders."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import subprocess
import threading
from urllib.parse import urlsplit
import uuid
from capture_assets import discover
from bitcoin import capture as capture_bitcoin, txid as bitcoin_txid
from kit import hex_id, base58
from solana import capture as capture_solana, history as solana_history, signature as solana_signature

ROOT=Path(__file__).resolve().parent
LIMIT=2_100_000


def node_case(data,mode='validate'):
    raw=json.dumps(data,ensure_ascii=True,separators=(',',':')).encode()
    if len(raw)>2_000_000:raise ValueError('Case too large')
    result=subprocess.run(['node',str(ROOT/'case_io.mjs'),mode],input=raw,capture_output=True,timeout=30)
    if result.returncode or len(result.stdout)>2_000_000:raise ValueError('Case validation failed')
    return json.loads(result.stdout)


def metadata(title,note):
    if not isinstance(title,str) or not 1<=len(title.strip())<=100 or not isinstance(note,str) or len(note)>2000:
        raise ValueError('Title/note limits')
    return title.strip(),note


class CaseStore:
    def __init__(self,directory,validator=node_case):
        self.directory=Path(directory);self.directory.mkdir(parents=True,exist_ok=True)
        self.path=self.directory/'investigations.sqlite3';self.validator=validator
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY,title TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,evidence TEXT NOT NULL)')

    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.path,timeout=10)
        try:
            with db:yield db
        finally:db.close()

    def save(self,case,title,note):
        title,note=metadata(title,note);case=self.validator(case)
        identifier=uuid.uuid4().hex;now=datetime.now(timezone.utc).isoformat()
        with self.connect() as db:
            db.execute('INSERT INTO cases VALUES (?,?,?,?,?,?)',(identifier,title,note,now,now,json.dumps(case,ensure_ascii=True,separators=(',',':'))))
        return identifier

    def list(self):
        with self.connect() as db:
            rows=db.execute('SELECT id,title,created_at,updated_at FROM cases ORDER BY updated_at DESC,id LIMIT 100').fetchall()
        return [dict(zip(['id','title','createdAt','updatedAt'],row)) for row in rows]

    def get(self,identifier):
        if not re.fullmatch('[0-9a-f]{32}',identifier):raise KeyError('Case not found')
        with self.connect() as db:
            row=db.execute('SELECT id,title,note,created_at,updated_at,evidence FROM cases WHERE id=?',(identifier,)).fetchone()
        if row is None:raise KeyError('Case not found')
        return {'id':row[0],'title':row[1],'note':row[2],'createdAt':row[3],'updatedAt':row[4],'case':json.loads(row[5])}

    def annotate(self,identifier,title,note):
        self.get(identifier);title,note=metadata(title,note)
        with self.connect() as db:
            db.execute('UPDATE cases SET title=?,note=?,updated_at=? WHERE id=?',(title,note,datetime.now(timezone.utc).isoformat(),identifier))


class InvestigationsServer(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,address,store,discovery=discover,converter=node_case,bitcoin_capture=capture_bitcoin,solana_capture=capture_solana,solana_discovery=solana_history):
        self.store=store;self.discovery=discovery;self.converter=converter;self.bitcoin_capture=bitcoin_capture;self.solana_capture=solana_capture;self.solana_discovery=solana_discovery
        self.token=secrets.token_urlsafe(32);self.jobs={};self.lock=threading.Lock();self.busy=False
        super().__init__(address,Handler)

    def expand(self,data):
        if not isinstance(data,dict) or set(data)!={'chainId','address','fromBlock','toBlock','trace'}:raise ValueError('Expansion fields')
        chain=data['chainId'];start=data['fromBlock'];end=data['toBlock']
        if type(chain) is not int or chain not in (1,10) or type(start) is not int or type(end) is not int or type(data['trace']) is not bool:
            raise ValueError('Expansion types')
        if not 0<=start<=end<=2**53-1 or end-start>=20:raise ValueError('Block limits')
        address=hex_id(data['address'],40)
        endpoint=os.environ.get('ETH_RPC_URL' if chain==1 else 'OP_RPC_URL')
        if not endpoint:raise ValueError('Configure server RPC environment')
        return self.queue_job(lambda:self.converter(self.discovery(endpoint,chain,address,start,end,data['trace']),'assets'),
                              f'Chain {chain}: {address[:10]} blocks {start}-{end}')

    def bitcoin(self,data):
        if not isinstance(data,dict) or set(data)!={'txid'}:raise ValueError('Bitcoin fields')
        identifier=bitcoin_txid(data['txid'])
        endpoint=os.environ.get('BTC_ESPLORA_URL','https://blockstream.info/api')
        return self.queue_job(lambda:self.converter(self.bitcoin_capture(identifier,endpoint),'bitcoin'),
                              f'Bitcoin: {identifier[:16]}')

    def solana(self,data):
        if not isinstance(data,dict) or set(data)!={'signature'}:raise ValueError('Solana fields')
        identifier=solana_signature(data['signature'])
        endpoint=os.environ.get('SOL_RPC_URL','https://api.mainnet-beta.solana.com')
        return self.queue_job(lambda:self.converter(self.solana_capture(identifier,endpoint),'solana'),
                              f'Solana: {identifier[:16]}')

    def solana_page(self,data):
        if not isinstance(data,dict) or set(data)!={'address','before'}:raise ValueError('Solana history fields')
        address=base58(data['address'],32);before=data['before']
        if before is not None:solana_signature(before)
        endpoint=os.environ.get('SOL_RPC_URL','https://api.mainnet-beta.solana.com')
        with self.lock:
            if self.busy:raise BlockingIOError('One provider operation at a time')
            self.busy=True
        try:return self.solana_discovery(address,endpoint,before)
        finally:
            with self.lock:self.busy=False

    def queue_job(self,operation,title):
        with self.lock:
            if self.busy:raise BlockingIOError('One expansion at a time')
            self.busy=True
            while len(self.jobs)>=20:self.jobs.pop(next(iter(self.jobs)))
            identifier=uuid.uuid4().hex;self.jobs[identifier]={'id':identifier,'status':'running'}
        def work():
            try:
                case=operation()
                saved=self.store.save(case,title,'')
                result={'id':identifier,'status':'succeeded','caseId':saved}
            except Exception:
                result={'id':identifier,'status':'failed','message':'Expansion failed. Check provider access, supported evidence, or a narrower range. Provider details withheld.'}
            with self.lock:self.jobs[identifier]=result;self.busy=False
        threading.Thread(target=work,daemon=True).start()
        return identifier



class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'web'),**kwargs)
    def setup(self):
        super().setup();self.connection.settimeout(15)
    def log_message(self,*args):pass  # No case bodies, endpoint URLs, tokens, or provider errors in logs.
    def list_directory(self,path):self.reply(403,{'error':'Directory listing disabled'})

    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cross-Origin-Resource-Policy','same-origin')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        super().end_headers()

    def allowed(self,write=False):
        host=self.headers.get('Host','');port=self.server.server_port
        if host not in (f'127.0.0.1:{port}',f'localhost:{port}'):return False
        origin=self.headers.get('Origin')
        if origin is not None and origin!='http://'+host:return False
        if write:
            token=self.headers.get('X-Investigation-Token','')
            if origin!='http://'+host or not secrets.compare_digest(token,self.server.token):return False
        return True

    def reply(self,status,data):
        raw=json.dumps(data,ensure_ascii=True,separators=(',',':')).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)

    def do_GET(self):
        if not self.allowed():self.reply(403,{'error':'Local same-origin access required'});return
        path=urlsplit(self.path).path
        try:
            if path=='/api/status':
                self.reply(200,{'local':True,'token':self.server.token,'rpcConfigured':{'1':bool(os.environ.get('ETH_RPC_URL')),'10':bool(os.environ.get('OP_RPC_URL'))}})
            elif path=='/api/cases':self.reply(200,{'cases':self.server.store.list(),'limit':100})
            elif re.fullmatch('/api/cases/[0-9a-f]{32}',path):self.reply(200,self.server.store.get(path.rsplit('/',1)[1]))
            elif re.fullmatch('/api/jobs/[0-9a-f]{32}',path):
                with self.server.lock:job=self.server.jobs.get(path.rsplit('/',1)[1])
                if job is None:raise KeyError()
                self.reply(200,job)
            elif path.startswith('/api/'):self.reply(404,{'error':'Unknown local API route'})
            elif path in ('/','/index.html'):
                raw=(ROOT/'web/index.html').read_text(encoding='utf-8').replace('<head>','<head><meta name="investigation-service" content="local">',1).encode()
                self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
            else:super().do_GET()
        except KeyError:self.reply(404,{'error':'Case/job not found'})
        except (ValueError,OSError,sqlite3.Error):self.reply(500,{'error':'Local read failed'})

    def do_POST(self):self.mutate(False)
    def do_PATCH(self):self.mutate(True)
    def do_HEAD(self):
        if not self.allowed():self.reply(403,{'error':'Local same-origin access required'});return
        super().do_HEAD()
    def mutate(self,patch):
        if not self.allowed(True):self.reply(403,{'error':'Same-origin session token required'});return
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=LIMIT or self.headers.get('Transfer-Encoding'):raise ValueError()
            if self.headers.get_content_type()!='application/json':raise ValueError()
            data=json.loads(self.rfile.read(length))
            path=urlsplit(self.path).path
            if not patch and path=='/api/cases':
                if not isinstance(data,dict) or set(data)!={'case','title','note'}:raise ValueError()
                identifier=self.server.store.save(data['case'],data['title'],data['note']);self.reply(201,{'id':identifier})
            elif patch and re.fullmatch('/api/cases/[0-9a-f]{32}',path):
                if not isinstance(data,dict) or set(data)!={'title','note'}:raise ValueError()
                identifier=path.rsplit('/',1)[1];self.server.store.annotate(identifier,data['title'],data['note']);self.reply(200,{'id':identifier})
            elif not patch and path=='/api/solana/history':self.reply(200,self.server.solana_page(data))
            elif not patch and path=='/api/solana':self.reply(202,{'id':self.server.solana(data)})
            elif not patch and path=='/api/bitcoin':self.reply(202,{'id':self.server.bitcoin(data)})
            elif not patch and path=='/api/expand':self.reply(202,{'id':self.server.expand(data)})
            else:self.reply(404,{'error':'Unknown local API route'})
        except BlockingIOError:self.reply(409,{'error':'An expansion is already running'})
        except KeyError:self.reply(404,{'error':'Case not found'})
        except (ValueError,TypeError,RecursionError):self.reply(400,{'error':'Invalid request, evidence, metadata, or configured RPC'})
        except (OSError,sqlite3.Error,subprocess.SubprocessError):self.reply(500,{'error':'Local operation failed; details withheld'})


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--port',type=int,default=8080);parser.add_argument('--data-dir',default=str(ROOT/'private-cases'))
    args=parser.parse_args();server=InvestigationsServer(('127.0.0.1',args.port),CaseStore(args.data_dir))
    print(f'Local investigation workspace: http://127.0.0.1:{server.server_port}',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()


if __name__=='__main__':main()
