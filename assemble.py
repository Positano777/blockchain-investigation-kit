"""Assemble bounded Ethereum receipt bundles into one reproducible case."""
import argparse
import hashlib
import json
from collect import receipt_case
from kit import load, seal, MAX_BYTES


def bundle_digest(bundle):
    raw = json.dumps(bundle, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()
    return 'sha256:' + hashlib.sha256(raw).hexdigest()


def assemble(bundles):
    if not isinstance(bundles, list) or not 1 <= len(bundles) <= 50:
        raise ValueError('Supply 1 to 50 receipt bundles')
    nodes, edges, receipts, sources, synthetic = {}, {}, {}, set(), set()
    for bundle in bundles:
        case = receipt_case(bundle)
        synthetic.add(case['synthetic'])
        edge = case['edges'][0]
        tx = edge['id']
        if tx in edges and (edge != edges[tx] or case['receipt'] != receipts[tx]):
            raise ValueError('Conflicting evidence for transaction ' + tx)
        edges[tx] = edge
        receipts[tx] = case['receipt']
        for node in case['nodes']:
            nodes[node['id']] = node
        sources.add((tx, bundle_digest(bundle)))
    if len(synthetic) != 1:
        raise ValueError('Synthetic and nonsynthetic evidence cannot be mixed')
    return seal({'schema': 'positano.investigation.v1', 'network': 'eth',
                 'synthetic': synthetic.pop(),
                 'coverage': 'Only supplied Ethereum RPC receipt bundles. Duplicate transactions counted once; conflicting transaction or receipt fields rejected. Sources identified by content checksums, not authenticated signatures. No complete wallet history, internal calls, token events, finality check, ownership inference, or cross-chain attribution.',
                 'nodes': [nodes[key] for key in sorted(nodes)],
                 'edges': sorted(edges.values(), key=lambda edge: (edge['timestamp'], edge['id'])),
                 'receipts': {key: receipts[key] for key in sorted(receipts)},
                 'sources': [{'transaction': tx, 'bundleDigest': digest} for tx, digest in sorted(sources)]})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', help='New case path; existing files are never overwritten')
    parser.add_argument('inputs', nargs='+', help='1 to 50 receipt-bundle JSON files')
    args = parser.parse_args()
    try:
        if len(args.inputs) > 50:
            raise ValueError('Too many input files')
        case = assemble([load(path) for path in args.inputs])
        data = (json.dumps(case, indent=2) + '\n').encode()
        if len(data) > MAX_BYTES:
            raise ValueError('Output exceeds portable case limit')
        with open(args.output, 'xb') as target:
            target.write(data)
        print('Case assembled. Open the output in the investigation workspace.')
    except (ValueError, KeyError, TypeError, AttributeError, OSError):
        parser.exit(1, 'Assembly failed. Check consistent mainnet receipt bundles, input limits, and a new output path.\n')


if __name__ == '__main__':
    main()
