"""Read-only Ethereum mainnet receipt capture. No signing or submission methods."""
import argparse
from datetime import datetime, timezone
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from kit import MAX_BYTES, hex_id, load, seal

METHODS = frozenset({'eth_chainId', 'eth_getTransactionByHash', 'eth_getTransactionReceipt', 'eth_getBlockByHash', 'eth_getBlockByNumber', 'debug_traceTransaction'})


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def quantity(value):
    if not isinstance(value, str) or not re.fullmatch(r'0x(?:0|[1-9a-fA-F][0-9a-fA-F]{0,63})', value):
        raise ValueError('Invalid RPC quantity')
    return int(value, 16)


def rpc(endpoint, method, params):
    if method not in METHODS:
        raise ValueError('RPC method not allowed')
    if method == 'debug_traceTransaction':
        if not isinstance(params, list) or len(params) != 2 or params[1] != {'tracer':'callTracer','timeout':'5s','tracerConfig':{'onlyTopCall':False}}:
            raise ValueError('Only the bounded built-in callTracer is allowed')
        hex_id(params[0],64)
    if method == 'eth_getBlockByNumber':
        if not isinstance(params,list) or len(params)!=2 or type(params[1]) is not bool:
            raise ValueError('Explicit block number and transaction mode required')
        quantity(params[0])
    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('Use an HTTPS RPC URL without userinfo or fragment')
    # RPC URLs may contain provider credentials. Never log or save this URL.
    request = urllib.request.Request(endpoint, data=json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': 'PositanoInvestigations/0.2'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            data = response.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError('RPC response too large')
        payload = json.loads(data)
        if not isinstance(payload, dict) or payload.get('jsonrpc') != '2.0' or type(payload.get('id')) is not int or payload['id'] != 1 or 'error' in payload or 'result' not in payload:
            raise ValueError('Invalid RPC response')
        return payload['result']
    except (OSError, ValueError, urllib.error.URLError) as error:
        raise ValueError('RPC read failed; endpoint and provider diagnostics withheld') from None


def capture(tx_hash, endpoint, transport=rpc):
    tx_hash = hex_id(tx_hash, 64)
    chain = transport(endpoint, 'eth_chainId', [])
    if quantity(chain) != 1:
        raise ValueError('Ethereum mainnet only')
    tx = transport(endpoint, 'eth_getTransactionByHash', [tx_hash])
    receipt = transport(endpoint, 'eth_getTransactionReceipt', [tx_hash])
    if not isinstance(tx, dict) or not isinstance(receipt, dict):
        raise ValueError('Transaction pending or unavailable')
    if hex_id(tx['hash'], 64) != tx_hash:
        raise ValueError('Wrong transaction returned')
    block_hash = hex_id(tx['blockHash'], 64)
    block = transport(endpoint, 'eth_getBlockByHash', [block_hash, False])
    bundle = {'schema': 'positano.rpc-receipt.v1', 'chainId': chain,
              'syntheticExample': False,
              'capturedAt': datetime.now(timezone.utc).isoformat(),
              'transaction': tx, 'receipt': receipt, 'block': block}
    receipt_case(bundle)  # validate consistency before persisting anything
    # Keep only fields consumed by the adapter; no provider diagnostics or URLs.
    keep = {
        'transaction': ['hash', 'from', 'to', 'value', 'blockHash', 'blockNumber', 'transactionIndex'],
        'receipt': ['transactionHash', 'from', 'to', 'status', 'blockHash', 'blockNumber', 'transactionIndex', 'gasUsed', 'effectiveGasPrice', 'blobGasUsed', 'blobGasPrice'],
        'block': ['hash', 'number', 'timestamp', 'transactions'],
    }
    for group, fields in keep.items():
        bundle[group] = {key: bundle[group][key] for key in fields if key in bundle[group]}
    return bundle


def receipt_case(bundle):
    if bundle.get('schema') != 'positano.rpc-receipt.v1' or quantity(bundle['chainId']) != 1:
        raise ValueError('Expected Ethereum mainnet receipt bundle')
    tx, receipt, block = bundle['transaction'], bundle['receipt'], bundle['block']
    if not all(isinstance(row, dict) for row in (tx, receipt, block)):
        raise ValueError('Missing mined transaction, receipt, or block')
    tx_hash = hex_id(tx['hash'], 64)
    if hex_id(receipt['transactionHash'], 64) != tx_hash:
        raise ValueError('Receipt transaction mismatch')
    a, b = hex_id(tx['from'], 40), hex_id(tx['to'], 40)
    if hex_id(receipt['from'], 40) != a or hex_id(receipt['to'], 40) != b:
        raise ValueError('Receipt address mismatch')
    block_hash = hex_id(block['hash'], 64)
    if any(hex_id(row['blockHash'], 64) != block_hash for row in (tx, receipt)):
        raise ValueError('Block hash mismatch')
    height = quantity(block['number'])
    if any(quantity(row['blockNumber']) != height for row in (tx, receipt)):
        raise ValueError('Block height mismatch')
    index = quantity(tx['transactionIndex'])
    transactions = block['transactions']
    if not isinstance(transactions, list) or len(transactions) > 10000 or index >= len(transactions) or hex_id(transactions[index], 64) != tx_hash or quantity(receipt['transactionIndex']) != index:
        raise ValueError('Transaction not at reported block index')
    for transaction in transactions:
        hex_id(transaction, 64)
    status = quantity(receipt['status'])
    if status not in (0, 1):
        raise ValueError('Unsupported receipt status')
    timestamp = quantity(block['timestamp'])
    if timestamp > 253402300799:
        raise ValueError('Invalid timestamp')
    value = quantity(tx['value'])
    gas = quantity(receipt['gasUsed'])
    price = quantity(receipt['effectiveGasPrice'])
    if ('blobGasUsed' in receipt) != ('blobGasPrice' in receipt):
        raise ValueError('Incomplete blob fee fields')
    blob_fee = quantity(receipt['blobGasUsed']) * quantity(receipt['blobGasPrice']) if 'blobGasUsed' in receipt else 0
    kind = 'rpc_failed_call' if not status else 'rpc_value_transfer' if value else 'rpc_call'
    edge = {'id': tx_hash, 'from': a, 'to': b, 'kind': kind,
            'amount': str(value if status else 0), 'unit': 'wei', 'timestamp': timestamp,
            'source': 'https://etherscan.io/tx/' + tx_hash}
    summary = {'status': 'success' if status else 'failed', 'requestedValueWei': str(value),
               'gasUsed': str(gas), 'effectiveGasPriceWei': str(price),
               'executionFeeWei': str(gas * price), 'blobFeeWei': str(blob_fee),
               'totalFeeWei': str(gas * price + blob_fee),
               'blockNumber': str(height), 'blockHash': block_hash,
               'transactionIndex': index}
    nodes = [{'id': address, 'network': 'eth', 'kind': 'address'} for address in dict.fromkeys([a, b])]
    return seal({'schema': 'positano.investigation.v1', 'network': 'eth',
                 'synthetic': bundle.get('syntheticExample') is True,
                 'coverage': 'One supplied RPC transaction, receipt, and block; fields cross-checked for consistency. Provider-reported execution, not cryptographic verification or a finality check. Top-level ETH value only; internal calls, token events, and wallet history excluded.',
                 'nodes': nodes, 'edges': [edge], 'receipt': summary})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('transaction', help='Ethereum transaction hash')
    parser.add_argument('output', help='New evidence-bundle path; never overwritten')
    parser.add_argument('--rpc-env', default='ETH_RPC_URL', help='Environment variable containing HTTPS endpoint; never saved')
    args = parser.parse_args()
    try:
        endpoint = os.environ.get(args.rpc_env)
        if not endpoint:
            raise ValueError('Set RPC environment variable')
        bundle = capture(args.transaction, endpoint)
        with open(args.output, 'xb') as target:
            target.write((json.dumps(bundle, indent=2) + '\n').encode())
        print('Receipt bundle saved. Convert with: python kit.py rpc INPUT OUTPUT')
    except (ValueError, KeyError, TypeError, AttributeError, OSError):
        parser.exit(1, 'Capture failed. Check RPC access, mined mainnet transaction, and new output path. Provider details withheld.\n')


if __name__ == '__main__':
    main()
