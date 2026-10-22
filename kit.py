"""Portable, offline blockchain evidence cases. Python 3.11+, standard library only."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from vendor.graphsense_gs import builder_from_spec

MAX_BYTES = 2_000_000


def load(path):
    with open(path, 'rb') as source:
        data = source.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('Input exceeds 2 MB')
    return json.loads(data)


def hex_id(value, length):
    if not isinstance(value, str) or not re.fullmatch(r'0x[0-9a-fA-F]{%d}' % length, value):
        raise ValueError('Invalid Ethereum identifier')
    return value.lower()


def base58(value, size):
    alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    if not isinstance(value, str) or not 1 <= len(value) <= 90:
        raise ValueError('Invalid Solana identifier')
    number = 0
    for char in value:
        if char not in alphabet:
            raise ValueError('Invalid Solana identifier')
        number = number * 58 + alphabet.index(char)
    count = len(value) - len(value.lstrip('1')) + (number.bit_length() + 7) // 8
    if count != size:
        raise ValueError('Invalid Solana identifier length')
    return value


def seal(case):
    raw = json.dumps(case, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()
    return dict(case, digest='sha256:' + hashlib.sha256(raw).hexdigest())


def eth_case(snapshot):
    rows = snapshot['transactions']
    if not isinstance(rows, list) or not 1 <= len(rows) <= 500:
        raise ValueError('Expected 1 to 500 transactions')
    nodes, edges, seen = {}, [], set()
    for row in rows:
        if row.get('tx_type') != 'account' or row.get('currency') != 'eth' or row.get('network', 'eth') != 'eth':
            raise ValueError('Only Ethereum native account transfers supported')
        tx = hex_id(row['tx_hash'], 64)
        if row.get('identifier', tx).lower() != tx or tx in seen or row.get('contract_creation', False):
            raise ValueError('Duplicate, internal, token, or contract-creation transaction')
        seen.add(tx)
        a, b = hex_id(row['from_address'], 40), hex_id(row['to_address'], 40)
        amount = row['value']['value']
        if isinstance(amount, bool) or not isinstance(amount, (str, int)) or not re.fullmatch(r'0|[1-9][0-9]{0,77}', str(amount)):
            raise ValueError('Amount must be an exact nonnegative integer')
        timestamp = row['timestamp']
        if type(timestamp) is not int or not 0 <= timestamp <= 253402300799:
            raise ValueError('Invalid timestamp')
        for address in (a, b):
            nodes[address] = {'id': address, 'network': 'eth', 'kind': 'address'}
        edges.append({'id': tx, 'from': a, 'to': b, 'kind': 'reported_native_transfer',
                      'amount': str(amount), 'unit': 'wei', 'timestamp': timestamp,
                      'source': 'https://etherscan.io/tx/' + tx})
    return seal({'schema': 'positano.investigation.v1', 'network': 'eth',
                 'synthetic': snapshot.get('syntheticExample') is True,
                 'coverage': 'Supplied GraphSense snapshots only; execution and completeness not independently verified.',
                 'nodes': list(nodes.values()), 'edges': edges})


def solana_case(data):
    if data.get('schema') != 'positano.launch-evidence.v1':
        raise ValueError('Expected launch-evidence.v1')
    mint = base58(data['mint'], 32)
    nodes = {mint: {'id': mint, 'network': 'sol', 'kind': 'mint'}}
    edges, seen = [], set()
    observations = data.get('launchSlotObservations') or {}
    rows = observations.get('transactions', [])
    if not isinstance(rows, list) or len(rows) > 500:
        raise ValueError('Too many observations')
    for row in rows:
        wallet = base58(row['wallet'], 32)
        sig = base58(row['source']['signature'], 64)
        pct = row['positiveDeltaPctOfSupply']
        if type(pct) not in (int, float) or not 0 < pct <= 100:
            raise ValueError('Invalid approximate supply percentage')
        if (sig, wallet) in seen:
            raise ValueError('Duplicate observation')
        seen.add((sig, wallet))
        nodes[wallet] = {'id': wallet, 'network': 'sol', 'kind': 'fee_payer'}
        edges.append({'id': sig, 'from': mint, 'to': wallet, 'kind': 'token_gain_observation',
                      'amount': str(pct), 'unit': 'approximate % of supply', 'timestamp': None,
                      'source': 'https://solscan.io/tx/' + sig})
    return seal({'schema': 'positano.investigation.v1', 'network': 'sol',
                 'synthetic': data.get('syntheticExample') is True,
                 'coverage': 'Supplied positive fee-payer deltas only. Not verified buys, transfers, common ownership, bundles, or full history. Creation allocations excluded by source sampler.',
                 'nodes': list(nodes.values()), 'edges': edges})


def graphsense_export(case):
    if case['network'] != 'eth':
        raise ValueError('Native GraphSense export supports ETH only; keep Solana in portable JSON')
    spec = {'addresses': [dict(id=n['id'], network='eth', starting_point=i == 0,
                                x=i * 10, y=0) for i, n in enumerate(case['nodes'])],
            'txs': [dict(id=e['id'], network='eth', x=i * 10 + 5, y=4)
                    for i, e in enumerate(case['edges'])],
            'agg_edges': [dict(a=e['from'], b=e['to'], tx_ids=[e['id']], network='eth')
                          for e in case['edges']]}
    return builder_from_spec(spec, name='Positano synthetic case' if case['synthetic'] else 'Positano imported case', default_network='eth').to_bytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('adapter', choices=['eth', 'sol'])
    parser.add_argument('input')
    parser.add_argument('output', help='New output path; existing files are never overwritten')
    parser.add_argument('--gs', action='store_true', help='Export GraphSense native ETH layout instead of portable JSON')
    args = parser.parse_args()
    try:
        case = (eth_case if args.adapter == 'eth' else solana_case)(load(args.input))
        result = graphsense_export(case) if args.gs else (json.dumps(case, indent=2) + '\n').encode()
        with open(args.output, 'xb') as target:
            target.write(result)
    except (ValueError, KeyError, TypeError, AttributeError, OSError) as error:
        parser.exit(1, 'Unable to create case: ' + type(error).__name__ + '. Check input and output path.\n')


if __name__ == '__main__':
    main()
