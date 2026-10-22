import copy
import unittest
from pathlib import Path
from assemble import assemble
from kit import load

ROOT = Path(__file__).resolve().parents[1]


class Assembly(unittest.TestCase):
    def setUp(self):
        self.first = load(ROOT / 'examples/eth-receipt.mainnet.json')

    def test_duplicates_not_double_counted(self):
        case = assemble([self.first, self.first])
        self.assertEqual(len(case['edges']), 1)
        self.assertEqual(len(case['sources']), 1)

    def test_multiple_captures_preserve_source_digests(self):
        other = copy.deepcopy(self.first)
        other['capturedAt'] = 'another capture'
        case = assemble([self.first, other])
        self.assertEqual(len(case['edges']), 1)
        self.assertEqual(len(case['sources']), 2)

    def test_receipt_and_transaction_conflicts_rejected(self):
        for group,key,value in [('transaction','value','0x1'),('receipt','gasUsed','0x1')]:
            other = copy.deepcopy(self.first)
            other[group][key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                assemble([self.first,other])

    def test_synthetic_mixing_rejected(self):
        other = copy.deepcopy(self.first)
        other['syntheticExample'] = True
        with self.assertRaises(ValueError): assemble([self.first,other])

    def test_bounds(self):
        for bundles in [[],[self.first]*51]:
            with self.assertRaises(ValueError): assemble(bundles)

    def test_deterministic_input_order(self):
        second = load(ROOT / 'examples/eth-receipt-second.mainnet.json')
        self.assertEqual(assemble([self.first,second]),assemble([second,self.first]))
        self.assertEqual(assemble([self.first,second]),load(ROOT / 'web/multi-case.json'))
