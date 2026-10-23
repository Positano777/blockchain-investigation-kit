"""Read-only bounded Solana mainnet transaction capture (standard library)."""
import argparse
from datetime import datetime, timezone
import json
import os
import subprocess
from pathlib import Path
import re
import urllib.parse
import urllib.request
from collect import NoRedirect
from kit import MAX_BYTES, base58, load

GENESIS='5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
SYSTEM='11111111111111111111111111111111'
TOKEN='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
CONFIG={'encoding':'jsonParsed','commitment':'finalized','maxSupportedTransactionVersion':0}


def check(ok,message='Invalid Solana evidence'):
    if not ok:raise ValueError(message)


def integer(v,maximum=2**53-1):
    check(type(v) is int and 0<=v<=maximum);return v


def amount(v):
    check(type(v) in (str,int) and re.fullmatch('0|[1-9][0-9]{0,19}',str(v)) and int(v)<=2**64-1)
    return str(v)


def signature(v):return base58(v,64)


def rpc(endpoint,method,params):
    if method=='getGenesisHash':check(params==[])
    elif method=='getTransaction':
        check(isinstance(params,list) and len(params)==2 and params[1]==CONFIG);signature(params[0])
    elif method=='getSignaturesForAddress':
        check(isinstance(params,list) and len(params)==2);base58(params[0],32)
        config=params[1];check(isinstance(config,dict) and set(config) in ({'commitment','limit'},{'commitment','limit','before'}) and config['commitment']=='finalized' and type(config['limit']) is int and config['limit']==5)
        if 'before' in config:signature(config['before'])
    else:raise ValueError('Solana method not allowed')
    parsed=urllib.parse.urlsplit(endpoint)
    check(parsed.scheme=='https' and parsed.hostname and not parsed.username and not parsed.password and not parsed.fragment,'HTTPS provider required')
    request=urllib.request.Request(endpoint,data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json','User-Agent':'PositanoInvestigations/SolanaPreview'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request,timeout=20) as response:data=response.read(MAX_BYTES+1)
        check(len(data)<=MAX_BYTES)
        payload=json.loads(data)
        check(isinstance(payload,dict) and payload.get('jsonrpc')=='2.0' and type(payload.get('id')) is int and payload['id']==1 and 'error' not in payload and 'result' in payload)
        return payload['result']
    except (OSError,ValueError):raise ValueError('Solana read failed; endpoint and provider details withheld') from None


def project(row,identifier,captured_at=None):
    check(isinstance(row,dict) and row.get('meta') is not None,'Transaction unavailable')
    meta=row['meta'];tx=row['transaction'];message=tx['message']
    check(isinstance(tx['signatures'],list) and 1<=len(tx['signatures'])<=64 and tx['signatures'][0]==signature(identifier),'Wrong transaction signature')
    for value in tx['signatures']:signature(value)
    version=row.get('version','legacy');check(version=='legacy' or type(version) is int and version==0,'Only legacy/v0 transactions supported')
    keys=message['accountKeys'];check(isinstance(keys,list) and 1<=len(keys)<=256)
    check(isinstance(meta['preBalances'],list) and isinstance(meta['postBalances'],list) and len(meta['preBalances'])==len(keys)==len(meta['postBalances']))
    accounts=[];seen=set()
    for index,key in enumerate(keys):
        address=base58(key['pubkey'],32);check(address not in seen and type(key['signer']) is bool and type(key['writable']) is bool)
        seen.add(address);accounts.append({'address':address,'signer':key['signer'],'writable':key['writable'],'preLamports':amount(meta['preBalances'][index]),'postLamports':amount(meta['postBalances'][index])})
    check(accounts[0]['signer'] and accounts[0]['writable'])
    # Token-account mint labels come only from supplied token balance metadata.
    mint_candidates={}
    for balances in (meta.get('preTokenBalances'),meta.get('postTokenBalances')):
        if balances is None:continue
        check(isinstance(balances,list) and len(balances)<=256)
        for balance in balances:
            index=integer(balance['accountIndex'],len(accounts)-1);mint=base58(balance['mint'],32)
            mint_candidates.setdefault(accounts[index]['address'],set()).add(mint)
    def instruction(value):
        program=base58(value['programId'],32);check(program in seen)
        parsed=value.get('parsed')
        if not isinstance(parsed,dict):return {'programId':program,'kind':'unsupported'}
        kind=parsed.get('type');info=parsed.get('info')
        if program==SYSTEM and kind=='transfer':
            check(isinstance(info,dict));result={'programId':program,'kind':'sol_transfer','source':base58(info['source'],32),'destination':base58(info['destination'],32),'amount':amount(info['lamports'])}
        elif program==TOKEN and kind in ('transfer','transferChecked'):
            check(isinstance(info,dict));source=base58(info['source'],32);destination=base58(info['destination'],32)
            if kind=='transferChecked':
                mint=base58(info['mint'],32);units=amount(info['tokenAmount']['amount']);decimals=integer(info['tokenAmount']['decimals'],255)
                for account in (source,destination):
                    if account in mint_candidates:check(mint_candidates[account]=={mint},'Token mint metadata mismatch')
            else:
                units=amount(info['amount']);decimals=None
                candidates=mint_candidates.get(source,set())|mint_candidates.get(destination,set())
                check(len(candidates)<=1,'Conflicting token mint metadata');mint=next(iter(candidates),None)
            result={'programId':program,'kind':'token_transfer','source':source,'destination':destination,'amount':units,'mint':mint,'decimals':decimals}
        else:return {'programId':program,'kind':'unsupported'}
        check(result['source'] in seen and result['destination'] in seen)
        return result
    top=message['instructions'];check(isinstance(top,list) and 1<=len(top)<=128)
    instructions=[instruction(value) for value in top]
    inner=meta.get('innerInstructions');groups=None
    if inner is not None:
        check(isinstance(inner,list) and len(inner)<=len(top));groups=[];indices=set();total=len(top)
        for group in inner:
            index=integer(group['index'],len(top)-1);check(index not in indices);indices.add(index)
            check(isinstance(group['instructions'],list));total+=len(group['instructions']);check(total<=256,'Instruction cap exceeded')
            groups.append({'index':index,'instructions':[instruction(value) for value in group['instructions']]})
        groups.sort(key=lambda group:group['index'])
    block_time=row.get('blockTime');check(block_time is None or type(block_time) is int and 0<=block_time<=253402300799)
    return {'schema':'positano.solana-transaction.v1','network':'solana-mainnet','genesisHash':GENESIS,'syntheticExample':False,
            'capturedAt':captured_at or datetime.now(timezone.utc).isoformat(),'signature':identifier,'slot':integer(row['slot']),
            'blockTime':block_time,'version':version,'requestedCommitment':'finalized','feeLamports':amount(meta['fee']),
            'success':meta['err'] is None,'accounts':accounts,'topInstructions':instructions,'innerInstructions':groups}


def capture(identifier,endpoint,transport=rpc):
    identifier=signature(identifier);check(transport(endpoint,'getGenesisHash',[])==GENESIS,'Solana mainnet only')
    return project(transport(endpoint,'getTransaction',[identifier,dict(CONFIG)]),identifier)


def history(address,endpoint,before=None,transport=rpc):
    address=base58(address,32)
    config={'commitment':'finalized','limit':5}
    if before is not None:config['before']=signature(before)
    check(transport(endpoint,'getGenesisHash',[])==GENESIS,'Solana mainnet only')
    rows=transport(endpoint,'getSignaturesForAddress',[address,config]);check(isinstance(rows,list) and len(rows)<=5)
    results=[];seen=set()
    for row in rows:
        value=signature(row['signature']);check(value not in seen and value!=before);seen.add(value)
        block_time=row.get('blockTime');check(block_time is None or type(block_time) is int and 0<=block_time<=253402300799)
        check(row.get('confirmationStatus')=='finalized')
        results.append({'signature':value,'slot':integer(row['slot']),'success':row['err'] is None,'blockTime':block_time})
    check(all(results[i]['slot']>=results[i+1]['slot'] for i in range(len(results)-1)))
    return {'schema':'positano.solana-history-page.v1','network':'solana-mainnet','address':address,'before':before,
            'capturedAt':datetime.now(timezone.utc).isoformat(),'limit':5,'pageCapReached':len(results)==5,
            'nextBefore':results[-1]['signature'] if results else None,'transactions':results,
            'coverage':'At most five provider-reported signatures referencing this account. Page cap does not prove more results exist. No complete history, ownership, or value-transfer assertion.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('mode',choices=['capture','build','history']);parser.add_argument('subject');parser.add_argument('output');parser.add_argument('--before')
    args=parser.parse_args()
    try:
        endpoint=os.environ.get('SOL_RPC_URL','https://api.mainnet-beta.solana.com')
        if args.mode=='capture':data=capture(args.subject,endpoint)
        elif args.mode=='history':data=history(args.subject,endpoint,args.before)
        else:
            result=subprocess.run(['node',str(Path(__file__).with_name('case_io.mjs')),'solana'],input=json.dumps(load(args.subject)).encode(),capture_output=True,timeout=30)
            check(result.returncode==0 and len(result.stdout)<=MAX_BYTES);data=json.loads(result.stdout)
        encoded=json.dumps(data,indent=2,ensure_ascii=True)+'\n';check(len(encoded.encode())<=MAX_BYTES)
        with open(args.output,'x',encoding='utf-8') as target:target.write(encoded)
    except (ValueError,KeyError,TypeError,OSError,subprocess.SubprocessError):parser.exit(1,'Solana operation failed; invalid evidence, output path, or unavailable provider. Details withheld.\n')


if __name__=='__main__':main()
