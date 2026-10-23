import json
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
from serve import CaseStore,InvestigationsServer,node_case
from kit import load

ROOT=Path(__file__).resolve().parents[1]


class Persistence(unittest.TestCase):
    def test_restart_notes_and_parameterized_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            store=CaseStore(directory,lambda data:data)
            case=load(ROOT/'web/bridge-case.json')
            identifier=store.save(case,'Bridge review','Observed; not attributed')
            store=CaseStore(directory,lambda data:data)
            store.annotate(identifier,'Updated title',"'); DROP TABLE cases; --")
            saved=store.get(identifier)
            self.assertEqual(saved['case'],case)
            self.assertEqual(saved['note'],"'); DROP TABLE cases; --")
            self.assertEqual(len(store.list()),1)
            with self.assertRaises(KeyError):store.get('../secrets')

    def test_tampered_case_and_invalid_metadata_not_saved(self):
        with tempfile.TemporaryDirectory() as directory:
            store=CaseStore(directory)
            case=load(ROOT/'web/bridge-case.json');case['bridge']['mintWei']='1'
            with self.assertRaises(ValueError):store.save(case,'Tampered','')
            with self.assertRaises(ValueError):store.save({},'','')
            self.assertEqual(store.list(),[])

    def test_all_schemas_validate_through_stdin(self):
        for name in ['bridge','assets','trace','hop','multi','eth','sol','real']:
            case=load(ROOT/f'web/{name}-case.json')
            self.assertEqual(node_case(case),case)


class LocalAPI(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.store=CaseStore(self.directory.name,lambda data:data)
        self.server=InvestigationsServer(('127.0.0.1',0),self.store)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        self.origin=f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.directory.cleanup()

    def request(self,path,data=None,method=None,headers=None):
        raw=None if data is None else json.dumps(data).encode()
        request=urllib.request.Request(self.origin+path,data=raw,method=method,headers=headers or {})
        try:
            with urllib.request.urlopen(request,timeout=5) as response:return response.status,response.read(),response.headers
        except urllib.error.HTTPError as error:return error.code,error.read(),error.headers

    def write_headers(self):return {'Origin':self.origin,'Content-Type':'application/json','X-Investigation-Token':self.server.token}

    def test_status_html_and_no_credentials(self):
        with patch.dict(os.environ,{'ETH_RPC_URL':'https://provider.invalid/not-a-real-credential'}):
            code,raw,headers=self.request('/api/status')
            self.assertEqual(code,200);self.assertNotIn(b'not-a-real-credential',raw)
            self.assertEqual(headers['Cache-Control'],'no-store');self.assertNotIn('Access-Control-Allow-Origin',headers)
            code,raw,_=self.request('/');self.assertIn(b'name="investigation-service"',raw)

    def test_cross_origin_host_and_token_rejected(self):
        for headers in [{'Host':'attacker.invalid'},{'Origin':'https://attacker.invalid'}]:
            self.assertEqual(self.request('/api/status',headers=headers)[0],403)
        body={'case':{},'title':'Case','note':''}
        self.assertEqual(self.request('/api/cases',body)[0],403)
        headers=self.write_headers();headers['X-Investigation-Token']='wrong'
        self.assertEqual(self.request('/api/cases',body,headers=headers)[0],403)

    def test_save_open_and_annotate(self):
        case=load(ROOT/'web/hop-case.json')
        code,raw,_=self.request('/api/cases',{'case':case,'title':'Test case','note':'Analyst hypothesis'},headers=self.write_headers())
        self.assertEqual(code,201);identifier=json.loads(raw)['id']
        self.assertEqual(json.loads(self.request('/api/cases/'+identifier)[1])['case'],case)
        self.assertEqual(self.request('/api/cases/'+identifier,{'title':'Retitled','note':'Changed'},'PATCH',self.write_headers())[0],200)
        self.assertEqual(self.store.get(identifier)['case']['digest'],case['digest'])

    def test_job_persists_case_using_server_endpoint(self):
        recorded=[]
        def discover(endpoint,*args):recorded.append(endpoint);return load(ROOT/'examples/after-bridge.mainnet.json')
        self.server.discovery=discover;self.server.converter=lambda data,mode:load(ROOT/'web/hop-case.json')
        with patch.dict(os.environ,{'OP_RPC_URL':'https://provider.invalid/not-a-real-credential'}):
            code,raw,_=self.request('/api/expand',{'chainId':10,'address':'0x'+'1'*40,'fromBlock':1,'toBlock':5,'trace':False},headers=self.write_headers())
            self.assertEqual(code,202);identifier=json.loads(raw)['id']
            for _ in range(100):
                job=self.server.jobs[identifier]
                if job['status']!='running':break
                time.sleep(.01)
            self.assertEqual(job['status'],'succeeded');self.assertEqual(len(self.store.list()),1)
            self.assertEqual(recorded,['https://provider.invalid/not-a-real-credential'])

    def test_bounds_and_extra_endpoint_fields_rejected(self):
        data={'chainId':10,'address':'0x'+'1'*40,'fromBlock':1,'toBlock':21,'trace':False}
        self.assertEqual(self.request('/api/expand',data,headers=self.write_headers())[0],400)
        data['toBlock']=5;data['endpoint']='https://attacker.invalid'
        self.assertEqual(self.request('/api/expand',data,headers=self.write_headers())[0],400)

    def test_job_failure_redacts_provider_details(self):
        def failing(*args):raise ValueError('provider-secret-not-a-real-credential')
        self.server.discovery=failing
        with patch.dict(os.environ,{'OP_RPC_URL':'https://provider.invalid'}):
            identifier=self.server.expand({'chainId':10,'address':'0x'+'1'*40,'fromBlock':1,'toBlock':2,'trace':False})
            for _ in range(100):
                job=self.server.jobs[identifier]
                if job['status']!='running':break
                time.sleep(.01)
            self.assertEqual(job['status'],'failed')
            self.assertNotIn('provider-secret',json.dumps(job))

    def test_only_one_job_runs_at_a_time(self):
        release=threading.Event()
        def waiting(*args):
            release.wait(3)
            return load(ROOT/'examples/after-bridge.mainnet.json')
        self.server.discovery=waiting;self.server.converter=lambda data,mode:load(ROOT/'web/hop-case.json')
        with patch.dict(os.environ,{'OP_RPC_URL':'https://provider.invalid'}):
            data={'chainId':10,'address':'0x'+'1'*40,'fromBlock':1,'toBlock':2,'trace':False}
            identifier=self.server.expand(data)
            try:
                with self.assertRaises(BlockingIOError):self.server.expand(data)
            finally:release.set()
            for _ in range(100):
                if self.server.jobs[identifier]['status']!='running':break
                time.sleep(.01)


if __name__=='__main__':unittest.main()
