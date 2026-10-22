import copy
import unittest
import tempfile
from pathlib import Path
from kit import eth_case, solana_case, graphsense_export, load, seal
from vendor.graphsense_gs import decode_gs_bytes, structure

ROOT = Path(__file__).resolve().parents[1]


class Cases(unittest.TestCase):
    def setUp(self):
        self.snapshot = load(ROOT / 'examples/eth-snapshot.synthetic.json')

    def test_exact_large_amount(self):
        self.snapshot['transactions'][0]['value']['value'] = '123456789012345678901234567890'
        self.assertEqual(eth_case(self.snapshot)['edges'][0]['amount'], '123456789012345678901234567890')

    def test_reject_float_and_boolean(self):
        for amount in [1.1, True, -1, '1e18', '01']:
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                self.snapshot['transactions'][0]['value']['value'] = amount
                eth_case(self.snapshot)

    def test_duplicate_and_internal_rejected(self):
        self.snapshot['transactions'].append(copy.deepcopy(self.snapshot['transactions'][0]))
        with self.assertRaises(ValueError):
            eth_case(self.snapshot)

    def test_native_codec_contract(self):
        case = eth_case(self.snapshot)
        raw = decode_gs_bytes(graphsense_export(case))
        self.assertEqual(raw[:2], ['pathfinder', '1'])
        self.assertEqual(len(raw[3]), 3)
        self.assertEqual(len(raw[4]), 2)
        self.assertEqual(len(raw[6]), 2)
        self.assertEqual(raw[6][0][2][0], ['eth', case['edges'][0]['id']])
        self.assertIsNotNone(structure(raw))

    def test_digest_reproducible(self):
        case = eth_case(self.snapshot)
        digest = case.pop('digest')
        self.assertEqual(seal(case)['digest'], digest)

    def test_solana_is_observation_and_not_gs(self):
        case = solana_case(load(ROOT / 'examples/launch-map.synthetic.json'))
        self.assertEqual(len(case['edges']), 6)
        self.assertTrue(all(e['kind'] == 'token_gain_observation' for e in case['edges']))
        with self.assertRaises(ValueError):
            graphsense_export(case)

    def test_untrusted_urls_not_copied(self):
        data = load(ROOT / 'examples/launch-map.synthetic.json')
        data['launchSlotObservations']['transactions'][0]['source']['url'] = 'javascript:alert(1)'
        self.assertTrue(solana_case(data)['edges'][0]['source'].startswith('https://solscan.io/tx/'))

    def test_oversized_input_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'too-large.json'
            path.write_bytes(b' ' * 2_000_001)
            with self.assertRaises(ValueError):
                load(path)

    def test_vendor_integrity(self):
        import hashlib
        manifest = load(ROOT / 'vendor/PROVENANCE.json')
        for filename, expected in manifest['sha256'].items():
            self.assertEqual(hashlib.sha256((ROOT / 'vendor/graphsense_gs' / filename).read_bytes()).hexdigest(), expected)


if __name__ == '__main__':
    unittest.main()
