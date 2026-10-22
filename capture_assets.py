"""Read-only asset capture and bounded direct-address block discovery."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
from collect import rpc, quantity
from kit import hex_id, MAX_BYTES

ROOT=Path(__file__).resolve().parent
TRACE_CONFIG={'tracer':'callTracer','timeout':'5s','tracerConfig':{'onlyTopCall':False}}


def project_trace(raw,depth=0,budget=None):
    budget=[0] if budget is None else budget
    budget[0]+=1
    if depth>32 or budget[0]>1000 or not isinstance(raw,dict):
        raise ValueError('Trace bounds')
    kind=raw['type'].upper()
    if kind not in ['CALL','STATICCALL','DELEGATECALL','CALLCODE','CREATE','CREATE2','SELFDESTRUCT']:
        raise ValueError('Unsupported trace frame')
    calls=raw.get('calls',[])
    if not isinstance(calls,list) or len(calls)>1000:
        raise ValueError('Trace bounds')
    value=raw.get('value','0x0');quantity(value)
    return {'type':kind,'from':hex_id(raw['from'],40),'to':hex_id(raw['to'],40),
            'value':value,'failed':bool(raw.get('error')),
            'calls':[project_trace(child,depth+1,budget) for child in calls]}


def capture_record(endpoint,tx_hash,trace=False,transport=rpc):
    tx_hash=hex_id(tx_hash,64)
    tx=transport(endpoint,'eth_getTransactionByHash',[tx_hash])
    receipt=transport(endpoint,'eth_getTransactionReceipt',[tx_hash])
    if not isinstance(tx,dict) or not isinstance(receipt,dict) or hex_id(tx['hash'],64)!=tx_hash:
        raise ValueError('Mined transaction required')
    block=transport(endpoint,'eth_getBlockByHash',[hex_id(tx['blockHash'],64),False])
    tf=['hash','from','to','value','blockHash','blockNumber','transactionIndex']
    rf=['transactionHash','from','to','status','blockHash','blockNumber','transactionIndex','gasUsed','effectiveGasPrice']
    lf=['address','topics','data','blockNumber','transactionHash','transactionIndex','blockHash','logIndex','removed']
    logs=receipt['logs']
    if not isinstance(logs,list) or len(logs)>1000:
        raise ValueError('Receipt log bounds')
    result={'transaction':{k:tx[k] for k in tf},'receipt':{k:receipt[k] for k in rf},
            'block':{k:block[k] for k in ['hash','number','timestamp','transactions']},
            'trace':{'status':'not_requested','root':None}}
    result['receipt']['logs']=[{k:log[k] for k in lf} for log in logs]
    if trace:
        try:
            raw=transport(endpoint,'debug_traceTransaction',[tx_hash,TRACE_CONFIG])
            result['trace']={'status':'available','root':project_trace(raw)}
        except (ValueError,KeyError,TypeError,AttributeError,OSError):
            result['trace']={'status':'unavailable','root':None}
    return result


def discover(endpoint,chain,address,start,end,trace=False,transport=rpc):
    address=hex_id(address,40)
    if not 0<=start<=end<=2**64-1 or end-start>=20:
        raise ValueError('Use 1 to 20 explicit blocks')
    if quantity(transport(endpoint,'eth_chainId',[]))!=chain:
        raise ValueError('Wrong chain')
    scanned=[];records=[];seen=set();limited=False
    for number in range(start,end+1):
        block=transport(endpoint,'eth_getBlockByNumber',[hex(number),True])
        if not isinstance(block,dict) or quantity(block['number'])!=number or not isinstance(block['transactions'],list) or len(block['transactions'])>10000:
            raise ValueError('Invalid discovery block')
        scanned.append({'number':str(number),'hash':hex_id(block['hash'],64)})
        for tx in block['transactions']:
            if not isinstance(tx,dict):
                raise ValueError('Full transaction objects required')
            if address not in [str(tx.get('from','')).lower(),str(tx.get('to','')).lower()]:
                continue
            tx_hash=hex_id(tx['hash'],64)
            if tx_hash in seen:
                raise ValueError('Duplicate discovery transaction')
            seen.add(tx_hash)
            record=capture_record(endpoint,tx_hash,trace,transport)
            if hex_id(record['block']['hash'],64)!=scanned[-1]['hash']:
                raise ValueError('Block changed during capture')
            records.append(record)
            if len(records)==10:
                limited=True;break
        if limited:break
    return {'schema':'positano.asset-evidence.v1','chainId':hex(chain),'synthetic':False,'records':records,
            'discovery':{'mode':'direct_address_blocks','address':address,'fromBlock':str(start),'toBlock':str(end),'scannedBlocks':scanned,'limitReached':limited}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='mode',required=True)
    single=sub.add_parser('transaction');single.add_argument('chain',type=int,choices=[1,10]);single.add_argument('transaction');single.add_argument('output')
    hop=sub.add_parser('hop');hop.add_argument('chain',type=int,choices=[1,10]);hop.add_argument('address');hop.add_argument('start',type=int);hop.add_argument('end',type=int);hop.add_argument('output')
    for command in (single,hop):command.add_argument('--trace',action='store_true',help='Try built-in callTracer; unavailable traces remain explicit gaps')
    args=parser.parse_args()
    try:
        endpoint=os.environ['ETH_RPC_URL' if args.chain==1 else 'OP_RPC_URL']
        if args.mode=='hop':
            bundle=discover(endpoint,args.chain,args.address,args.start,args.end,args.trace)
        else:
            if quantity(rpc(endpoint,'eth_chainId',[]))!=args.chain:raise ValueError('Wrong chain')
            bundle={'schema':'positano.asset-evidence.v1','chainId':hex(args.chain),'synthetic':False,
                    'records':[capture_record(endpoint,args.transaction,args.trace)],
                    'discovery':{'mode':'supplied','address':None,'fromBlock':None,'toBlock':None,'scannedBlocks':[],'limitReached':False}}
        data=(json.dumps(bundle,indent=2)+'\n').encode()
        if len(data)>MAX_BYTES:raise ValueError('Bundle exceeds 2 MB')
        with tempfile.TemporaryDirectory(prefix='positano-assets-') as directory:
            path=Path(directory)/'input.json';path.write_bytes(data)
            subprocess.run(['node',str(ROOT/'assets.mjs'),str(path),str(Path(directory)/'case.json')],capture_output=True,text=True,timeout=30,check=True)
        with open(args.output,'xb') as target:target.write(data)
        print('Asset evidence saved. Build with: node assets.mjs INPUT NEW_OUTPUT')
    except (ValueError,KeyError,TypeError,AttributeError,OSError,subprocess.SubprocessError):
        parser.exit(1,'Capture failed. Check supported mined transactions, explicit bounds, RPC access, Node 22+, and new output path. Provider details withheld.\n')


if __name__=='__main__':main()
