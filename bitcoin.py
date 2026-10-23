"""Bounded Bitcoin-mainnet UTXO evidence capture and offline validation (stdlib)."""
import argparse
from datetime import datetime, timezone
import json
import os
import re
import urllib.parse
import urllib.request
from collect import NoRedirect
from kit import MAX_BYTES, load, seal

GENESIS = '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'
MAX_MONEY = 2_100_000_000_000_000
LIMIT = 20


def require(value, message='Invalid Bitcoin evidence'):
    if not value:
        raise ValueError(message)


def txid(value):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{64}', value), 'Invalid transaction ID')
    return value


def integer(value, maximum=MAX_MONEY):
    require(type(value) is int and 0 <= value <= maximum, 'Invalid exact integer')
    return value


def status(row):
    require(isinstance(row, dict) and type(row.get('confirmed')) is bool)
    if not row['confirmed']:
        return {'confirmed': False}
    return {'confirmed': True, 'block_height': integer(row['block_height'], 10_000_000),
            'block_hash': txid(row['block_hash']), 'block_time': integer(row['block_time'], 253402300799)}


def output(row):
    require(isinstance(row, dict))
    script = row['scriptpubkey']
    require(isinstance(script, str) and len(script) <= 20_000 and re.fullmatch('(?:[0-9a-f]{2})*', script))
    # Script bytes identify outputs. Provider address labels are deliberately excluded.
    return {'scriptpubkey': script, 'value': integer(row['value'])}


def transaction(row):
    require(isinstance(row, dict))
    identifier = txid(row['txid'])
    require(isinstance(row['vin'], list) and 1 <= len(row['vin']) <= LIMIT, 'Input cap exceeded')
    require(isinstance(row['vout'], list) and 1 <= len(row['vout']) <= LIMIT, 'Output cap exceeded')
    inputs, seen = [], set()
    for vin in row['vin']:
        require(isinstance(vin, dict) and vin.get('is_coinbase') is False, 'Coinbase inputs unsupported')
        previous = txid(vin['txid']); index = integer(vin['vout'], 0xffffffff)
        require(previous != identifier and (previous, index) not in seen, 'Duplicate or self input')
        seen.add((previous, index))
        inputs.append({'txid': previous, 'vout': index, 'is_coinbase': False, 'prevout': output(vin['prevout'])})
    outputs = [output(v) for v in row['vout']]
    total_in = sum(v['prevout']['value'] for v in inputs)
    total_out = sum(v['value'] for v in outputs)
    require(total_in <= MAX_MONEY and total_out <= MAX_MONEY)
    fee = integer(row['fee'])
    require(total_in - total_out == fee, 'Input/output/fee mismatch')
    return {'txid': identifier, 'vin': inputs, 'vout': outputs, 'fee': fee, 'status': status(row['status'])}


def validate(bundle):
    require(bundle.get('schema') == 'positano.bitcoin-utxo.v1' and bundle.get('network') == 'bitcoin-mainnet')
    require(bundle.get('genesisHash') == GENESIS and type(bundle.get('syntheticExample')) is bool)
    captured = bundle.get('capturedAt')
    require(isinstance(captured, str) and len(captured) <= 40)
    require(datetime.fromisoformat(captured).utcoffset() is not None, 'Capture time must include timezone')
    root = transaction(bundle['transaction'])
    observations = bundle['outspends']
    require(isinstance(observations, list) and len(observations) == len(root['vout']))
    spenders, projected = {}, []
    require(isinstance(bundle['spendingTransactions'], list) and len(bundle['spendingTransactions']) <= LIMIT)
    for row in bundle['spendingTransactions']:
        item = transaction(row)
        require(item['txid'] not in spenders and item['txid'] != root['txid'], 'Duplicate spending transaction')
        spenders[item['txid']] = item
    used = set()
    for index, row in enumerate(observations):
        require(isinstance(row, dict) and type(row.get('spent')) is bool)
        if not row['spent']:
            require(set(row) == {'spent'}, 'Unexpected unspent fields')
            projected.append({'spent': False})
            continue
        identifier = txid(row['txid']); vin = integer(row['vin'], LIMIT - 1)
        require(identifier in spenders, 'Missing spending transaction')
        spender = spenders[identifier]
        require(vin < len(spender['vin']), 'Invalid spending input index')
        reference = spender['vin'][vin]
        require(reference['txid'] == root['txid'] and reference['vout'] == index, 'Spending outpoint mismatch')
        require(reference['prevout'] == root['vout'][index], 'Spending previous output mismatch')
        require(status(row['status']) == spender['status'], 'Spending status mismatch')
        if spender['status']['confirmed']:
            require(root['status']['confirmed'] and spender['status']['block_height'] >= root['status']['block_height'], 'Impossible confirmation ordering')
        used.add(identifier)
        projected.append({'spent': True, 'txid': identifier, 'vin': vin, 'status': spender['status']})
    require(used == set(spenders), 'Unreferenced spending transaction')
    return {'schema': 'positano.bitcoin-utxo.v1', 'network': 'bitcoin-mainnet', 'genesisHash': GENESIS,
            'syntheticExample': bundle['syntheticExample'], 'capturedAt': captured, 'transaction': root,
            'outspends': projected, 'spendingTransactions': [spenders[k] for k in sorted(spenders)]}


def read(endpoint, path):
    parsed = urllib.parse.urlsplit(endpoint)
    require(parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password
            and not parsed.query and not parsed.fragment, 'HTTPS Esplora base URL required')
    require(path == '/block-height/0' or re.fullmatch('/tx/[0-9a-f]{64}(?:/outspends)?', path), 'Read path not allowed')
    request = urllib.request.Request(endpoint.rstrip('/') + path, headers={'User-Agent': 'PositanoInvestigations/BitcoinPreview'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            data = response.read(MAX_BYTES + 1)
        require(len(data) <= MAX_BYTES)
        return data.decode().strip() if path == '/block-height/0' else json.loads(data)
    except (OSError, ValueError):
        raise ValueError('Bitcoin read failed; endpoint and provider details withheld') from None


def capture(identifier, endpoint, transport=read):
    identifier = txid(identifier)
    require(transport(endpoint, '/block-height/0') == GENESIS, 'Provider is not Bitcoin mainnet')
    root = transaction(transport(endpoint, '/tx/' + identifier))
    require(root['txid'] == identifier, 'Wrong transaction returned')
    observations = transport(endpoint, '/tx/' + identifier + '/outspends')
    require(isinstance(observations, list) and len(observations) == len(root['vout']))
    spenders = {}
    for row in observations:
        require(isinstance(row, dict) and type(row.get('spent')) is bool)
        if row['spent']:
            spending = txid(row['txid'])
            if spending not in spenders:
                require(len(spenders) < LIMIT)
                item = transaction(transport(endpoint, '/tx/' + spending))
                require(item['txid'] == spending, 'Wrong spending transaction returned')
                spenders[spending] = item
    return validate({'schema': 'positano.bitcoin-utxo.v1', 'network': 'bitcoin-mainnet', 'genesisHash': GENESIS,
                     'syntheticExample': False, 'capturedAt': datetime.now(timezone.utc).isoformat(),
                     'transaction': root, 'outspends': observations, 'spendingTransactions': list(spenders.values())})


def investigate(bundle):
    data = validate(bundle)
    root = data['transaction']; identifier = root['txid']
    nodes = [{'id': 'btc:tx:' + identifier, 'kind': 'transaction'}]
    edges = []
    for index, vin in enumerate(root['vin']):
        point = vin['txid'] + ':' + str(vin['vout'])
        nodes.append({'id': 'btc:out:' + point, 'kind': 'outpoint'})
        edges.append({'from': 'btc:out:' + point, 'to': 'btc:tx:' + identifier,
                      'kind': 'spends', 'satoshis': str(vin['prevout']['value']), 'inputIndex': index})
    for index, out in enumerate(root['vout']):
        point = identifier + ':' + str(index)
        nodes.append({'id': 'btc:out:' + point, 'kind': 'outpoint'})
        edges.append({'from': 'btc:tx:' + identifier, 'to': 'btc:out:' + point, 'kind': 'creates', 'satoshis': str(out['value'])})
        observation = data['outspends'][index]
        if observation['spent']:
            destination = 'btc:tx:' + observation['txid']
            if not any(n['id'] == destination for n in nodes):nodes.append({'id': destination, 'kind': 'transaction'})
            edges.append({'from': 'btc:out:' + point, 'to': destination, 'kind': 'spends',
                          'satoshis': str(out['value']), 'inputIndex': observation['vin']})
    return seal({'schema': 'positano.bitcoin-investigation.v1', 'network': 'bitcoin-mainnet',
                 'synthetic': data['syntheticExample'], 'nodes': nodes, 'edges': edges,
                 'feeSatoshis': str(root['fee']), 'source': 'https://blockstream.info/tx/' + identifier,
                 'coverage': 'One supplied transaction and reported output spends at capture time. No ancestry crawl, ownership/change inference, consensus proof, or finality verification. Parent output amounts are provider-reported.',
                 'evidence': data})



def report(bundle):
    case = investigate(bundle)
    data = case['evidence']; root = data['transaction']
    lines = ['# Bitcoin outpoint investigation', '',
             '**Synthetic example**' if case['synthetic'] else '**Provider-reported mainnet evidence**', '',
             'Transaction: `' + root['txid'] + '`', 'Captured: ' + data['capturedAt'],
             'Fee: ' + case['feeSatoshis'] + ' satoshis', '', case['coverage'], '',
             '## Inputs', '', '| Input | Previous outpoint | Satoshis |', '| --- | --- | --- |']
    for index, vin in enumerate(root['vin']):
        lines.append(f"| {index} | `{vin['txid']}:{vin['vout']}` | {vin['prevout']['value']} |")
    lines += ['', '## Outputs and reported spends', '', '| Output | Satoshis | Spending transaction / input |', '| --- | --- | --- |']
    for index, out in enumerate(root['vout']):
        spend = data['outspends'][index]
        label = f"`{spend['txid']}` / {spend['vin']}" if spend['spent'] else 'Reported unspent at capture time'
        lines.append(f"| {index} | {out['value']} | {label} |")
    lines += ['', 'Content checksum: `' + case['digest'] + '`', '',
              'Retain the original evidence JSON for reproduction. This report does not assign input funds to specific outputs or identify owners.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['capture', 'build', 'report'])
    parser.add_argument('subject', help='Transaction ID for capture; evidence JSON path for build')
    parser.add_argument('output')
    args = parser.parse_args()
    try:
        result = capture(args.subject, os.environ.get('BTC_ESPLORA_URL', 'https://blockstream.info/api')) if args.mode == 'capture' else (report(load(args.subject)) if args.mode == 'report' else investigate(load(args.subject)))
        encoded = result if args.mode == 'report' else json.dumps(result, indent=2, ensure_ascii=True) + '\n'
        require(len(encoded.encode()) <= MAX_BYTES, 'Output exceeds 2 MB')
        with open(args.output, 'x', encoding='utf-8') as target:target.write(encoded)
    except (ValueError, KeyError, TypeError, OSError):
        parser.exit(1, 'Bitcoin operation failed; invalid evidence, output path, or unavailable provider. Details withheld.\n')


if __name__ == '__main__':main()
