import copy
import unittest
from pathlib import Path
from unittest.mock import patch
from collect import capture, receipt_case, quantity, rpc, NoRedirect
from kit import load, graphsense_export

ROOT = Path(__file__).resolve().parents[1]


class Receipts(unittest.TestCase):
    def setUp(self):
        self.bundle = load(ROOT / 'examples/eth-receipt.mainnet.json')

    def test_mainnet_reproduction(self):
        case = receipt_case(self.bundle)
        self.assertEqual(case, load(ROOT / 'web/real-case.json'))
        self.assertEqual(case['edges'][0]['kind'], 'rpc_call')
        self.assertEqual(case['receipt']['executionFeeWei'], '10496049762246930')
        self.assertFalse(case['synthetic'])

    def test_failed_value_is_not_transfer(self):
        self.bundle['receipt']['status'] = '0x0'
        self.bundle['transaction']['value'] = '0xde0b6b3a7640000'
        case = receipt_case(self.bundle)
        self.assertEqual(case['edges'][0]['kind'], 'rpc_failed_call')
        self.assertEqual(case['edges'][0]['amount'], '0')
        self.assertEqual(case['receipt']['requestedValueWei'], '1000000000000000000')
        with self.assertRaises(ValueError):
            graphsense_export(case)

    def test_successful_value_and_blob_fee(self):
        self.bundle['transaction']['value'] = '0xde0b6b3a7640000'
        self.bundle['receipt'].update(blobGasUsed='0x2', blobGasPrice='0x3')
        case = receipt_case(self.bundle)
        self.assertEqual(case['edges'][0]['kind'], 'rpc_value_transfer')
        self.assertEqual(int(case['receipt']['totalFeeWei']), 10496049762246936)
        self.assertTrue(graphsense_export(case))

    def test_mismatches_rejected(self):
        mutations = [
            ('receipt','transactionHash','0x'+'f'*64),
            ('receipt','blockHash','0x'+'f'*64),
            ('receipt','blockNumber','0x1'),
            ('receipt','transactionIndex','0x1'),
            ('receipt','from','0x'+'f'*40),
            ('receipt','status','0x2'),
            ('transaction','to',None),
            ('block','transactions',[]),
        ]
        for group,key,value in mutations:
            with self.subTest(key=key):
                bundle = copy.deepcopy(self.bundle)
                bundle[group][key] = value
                with self.assertRaises(ValueError):
                    receipt_case(bundle)

    def test_nonmainnet_and_incomplete_blob_rejected(self):
        self.bundle['chainId'] = '0x89'
        with self.assertRaises(ValueError): receipt_case(self.bundle)
        self.bundle['chainId'] = '0x1'
        self.bundle['receipt']['blobGasUsed'] = '0x1'
        with self.assertRaises(ValueError): receipt_case(self.bundle)

    def test_quantities_reject_ambiguous_values(self):
        for value in [True, 1, '0x', '0x01', '-1', '1', '0x'+'f'*65]:
            with self.subTest(value=value), self.assertRaises(ValueError): quantity(value)

    def test_capture_only_reads_and_projects(self):
        responses = dict(eth_chainId='0x1',eth_getTransactionByHash=self.bundle['transaction'],eth_getTransactionReceipt=self.bundle['receipt'],eth_getBlockByHash=self.bundle['block'])
        responses['eth_getTransactionReceipt']['provider_url'] = 'secret-do-not-export'
        methods = []
        def fake(endpoint,method,params):
            methods.append(method)
            return responses[method]
        result = capture(self.bundle['transaction']['hash'],'https://example.invalid',fake)
        self.assertEqual(methods,list(responses))
        self.assertNotIn('provider_url',result['receipt'])

    def test_pending_and_wrong_transaction(self):
        def fake(endpoint,method,params):
            return '0x1' if method == 'eth_chainId' else None
        with self.assertRaises(ValueError): capture(self.bundle['transaction']['hash'],'unused',fake)

    def test_rpc_rejects_write_and_unsafe_urls(self):
        with self.assertRaises(ValueError): rpc('https://example.invalid','eth_sendRawTransaction',[])
        for url in ['http://example.invalid','https://user:password@example.invalid','https://example.invalid/#fragment']:
            with self.assertRaises(ValueError): rpc(url,'eth_chainId',[])
        self.assertIsNone(NoRedirect().redirect_request(None,None,None,None,None,None))

    def test_rpc_errors_hide_credentials(self):
        with patch('urllib.request.build_opener') as opener:
            opener.return_value.open.side_effect = OSError('secret-provider-token')
            with self.assertRaises(ValueError) as error:
                rpc('https://example.invalid/api/secret-provider-token','eth_chainId',[])
            self.assertNotIn('secret-provider-token',str(error.exception))


if __name__ == '__main__': unittest.main()
