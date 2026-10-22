"""Capture one Ethereum -> OP Mainnet Portal deposit using read-only RPC."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
from collect import rpc, quantity
from kit import hex_id, MAX_BYTES

ROOT = Path(__file__).resolve().parent
PORTAL = '0xbeb5fc579115071764c7423a4f12edde41f106ed'
TOPIC = '0xb3813568d9991fc951961fcb4c784893574240a28925604d09fc577c55bb7c32'


def read_bundle(endpoint, tx_hash, chain_id, transport=rpc):
    if quantity(transport(endpoint, 'eth_chainId', [])) != chain_id:
        raise ValueError('Wrong RPC chain')
    tx = transport(endpoint, 'eth_getTransactionByHash', [hex_id(tx_hash, 64)])
    receipt = transport(endpoint, 'eth_getTransactionReceipt', [tx_hash])
    if not isinstance(tx, dict) or not isinstance(receipt, dict):
        raise ValueError('Mined transaction and receipt required')
    if hex_id(tx['hash'], 64) != tx_hash:
        raise ValueError('Wrong transaction')
    block = transport(endpoint, 'eth_getBlockByHash', [hex_id(tx['blockHash'], 64), False])
    if not isinstance(block, dict):
        raise ValueError('Block required')
    tx_fields = ['hash','from','to','value','blockHash','blockNumber','transactionIndex']
    if chain_id == 10:
        tx_fields += ['type','sourceHash','mint','gas','input','isSystemTx']
    receipt_fields = ['transactionHash','from','to','status','blockHash','blockNumber','transactionIndex']
    result = {'chainId': hex(chain_id),
              'transaction': {key: tx[key] for key in tx_fields if key in tx},
              'receipt': {key: receipt[key] for key in receipt_fields if key in receipt},
              'block': {key: block[key] for key in ['hash','number','timestamp','transactions']}}
    if chain_id == 1:
        logs = receipt.get('logs')
        if not isinstance(logs, list) or len(logs) > 1000:
            raise ValueError('Bounded receipt logs required')
        fields = ['address','topics','data','blockNumber','transactionHash','transactionIndex','blockHash','logIndex','removed']
        result['receipt']['logs'] = [{key: log[key] for key in fields if key in log}
            for log in logs if isinstance(log, dict) and log.get('address','').lower() == PORTAL
            and isinstance(log.get('topics'), list) and log['topics'] and log['topics'][0].lower() == TOPIC]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('transaction', help='Ethereum transaction hash containing a Portal deposit')
    parser.add_argument('output', help='New cross-network evidence bundle')
    parser.add_argument('--log-index', type=int, help='Global Ethereum log index; required for multiple deposits')
    args = parser.parse_args()
    try:
        source = read_bundle(os.environ['ETH_RPC_URL'], hex_id(args.transaction,64), 1)
        candidates = source['receipt']['logs']
        if args.log_index is None:
            if len(candidates) != 1:
                raise ValueError('Exactly one Portal event required, or select a log index')
            index = quantity(candidates[0]['logIndex'])
        else:
            index = args.log_index
        source['receipt']['logs'] = [log for log in candidates if quantity(log['logIndex']) == index]
        with tempfile.TemporaryDirectory(prefix='positano-bridge-') as directory:
            path = Path(directory) / 'source.json'
            path.write_text(json.dumps(source),encoding='utf-8')
            result = subprocess.run(['node',str(ROOT/'bridge.mjs'),'derive',str(path),str(index)],
                capture_output=True,text=True,timeout=30,check=True)
            derived = json.loads(result.stdout)
            destination = read_bundle(os.environ['OP_RPC_URL'], derived['transactionHash'], 10)
            bundle = {'schema':'positano.op-deposit-bundle.v1','synthetic':False,
                      'logIndex':index,'source':source,'destination':destination}
            encoded = (json.dumps(bundle,indent=2)+'\n').encode()
            if len(encoded) > MAX_BYTES:
                raise ValueError('Bundle too large')
            pair = Path(directory)/'pair.json'
            pair.write_bytes(encoded)
            subprocess.run(['node',str(ROOT/'bridge.mjs'),'build',str(pair),str(Path(directory)/'case.json')],
                capture_output=True,text=True,timeout=30,check=True)
            with open(args.output,'xb') as target:
                target.write(encoded)
        print('Cross-network bundle captured and derivation checked. Build the case with node bridge.mjs build INPUT OUTPUT.')
    except (ValueError,KeyError,TypeError,AttributeError,OSError,subprocess.SubprocessError):
        parser.exit(1,'Capture failed. Check read-only Ethereum/OP RPC access, supported deposit log, Node 22+, and new output path. Provider details withheld.\n')


if __name__ == '__main__': main()
