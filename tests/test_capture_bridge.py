import copy
import unittest
from pathlib import Path
from capture_bridge import read_bundle
from kit import load

ROOT = Path(__file__).resolve().parents[1]


class BridgeCapture(unittest.TestCase):
    def setUp(self):
        self.bundle = load(ROOT/'examples/op-deposit.mainnet.json')

    def transport(self,part,calls):
        def read(endpoint,method,params):
            calls.append(method)
            return {'eth_chainId':part['chainId'],'eth_getTransactionByHash':part['transaction'],
                    'eth_getTransactionReceipt':part['receipt'],'eth_getBlockByHash':part['block']}[method]
        return read

    def test_both_chains_use_four_read_methods(self):
        for group,chain in [('source',1),('destination',10)]:
            part=self.bundle[group]
            calls=[]
            result=read_bundle('not-logged',part['transaction']['hash'],chain,self.transport(part,calls))
            self.assertEqual(result,part)
            self.assertEqual(len(calls),4)

    def test_provider_diagnostics_are_projected_out(self):
        part=copy.deepcopy(self.bundle['source'])
        part['transaction']['rpc_url']='secret-do-not-copy'
        part['receipt']['provider_diagnostic']='secret-do-not-copy'
        result=read_bundle('unused',part['transaction']['hash'],1,self.transport(part,[]))
        self.assertNotIn('rpc_url',result['transaction'])
        self.assertNotIn('provider_diagnostic',result['receipt'])

    def test_wrong_chain_rejected_before_transaction_read(self):
        calls=[]
        with self.assertRaises(ValueError):
            read_bundle('unused',self.bundle['source']['transaction']['hash'],10,self.transport(self.bundle['source'],calls))
        self.assertEqual(calls,['eth_chainId'])

    def test_source_logs_are_required_and_bounded(self):
        for logs in [None,[{}]*1001]:
            part=copy.deepcopy(self.bundle['source'])
            part['receipt']['logs']=logs
            with self.assertRaises(ValueError):
                read_bundle('unused',part['transaction']['hash'],1,self.transport(part,[]))
