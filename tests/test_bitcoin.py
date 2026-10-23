import copy
import unittest
from pathlib import Path
from kit import load
from bitcoin import read, report
from bitcoin import GENESIS, capture, investigate, transaction, validate


def fixture():
    a,b,c='1'*64,'2'*64,'3'*64
    out={'scriptpubkey':'51','value':1000}
    root={'txid':a,'vin':[{'txid':c,'vout':0,'is_coinbase':False,'prevout':{'scriptpubkey':'51','value':1100}}],
          'vout':[out], 'fee':100,'status':{'confirmed':False}}
    spender={'txid':b,'vin':[{'txid':a,'vout':0,'is_coinbase':False,'prevout':dict(out)}],
             'vout':[{'scriptpubkey':'51','value':900}],'fee':100,'status':{'confirmed':False}}
    return {'schema':'positano.bitcoin-utxo.v1','network':'bitcoin-mainnet','genesisHash':GENESIS,
            'syntheticExample':True,'capturedAt':'2026-10-23T00:00:00+00:00','transaction':root,
            'outspends':[{'spent':True,'txid':b,'vin':0,'status':{'confirmed':False}}], 'spendingTransactions':[spender]}


class BitcoinTests(unittest.TestCase):
    def test_exact_fees_and_outpoint_relationships(self):
        case=investigate(fixture());self.assertEqual(case['feeSatoshis'],'100')
        self.assertEqual([e['kind'] for e in case['edges']],['spends','creates','spends'])
        self.assertEqual(case['edges'][1]['to'],case['edges'][2]['from'])
        self.assertEqual(case,investigate(fixture()))

    def test_boolean_amount_and_fee_mismatch(self):
        for value in [True,1.5,-1,2_100_000_000_000_001]:
            data=fixture();data['transaction']['vout'][0]['value']=value
            with self.assertRaises(ValueError):validate(data)
        data=fixture();data['transaction']['fee']=99
        with self.assertRaises(ValueError):validate(data)

    def test_duplicate_input_and_coinbase(self):
        data=fixture();data['transaction']['vin']*=2
        with self.assertRaises(ValueError):validate(data)
        data=fixture();data['transaction']['vin'][0]['is_coinbase']=True
        with self.assertRaises(ValueError):validate(data)

    def test_spend_reference_and_prevout_consistency(self):
        for mutate in [lambda d:d['outspends'][0].update(vin=1),
                       lambda d:d['spendingTransactions'][0]['vin'][0].update(vout=1),
                       lambda d:d['spendingTransactions'][0]['vin'][0]['prevout'].update(scriptpubkey='52'),
                       lambda d:d['outspends'][0].update(status={'confirmed':True,'block_hash':'4'*64,'block_height':1,'block_time':1})]:
            data=copy.deepcopy(fixture());mutate(data)
            with self.assertRaises(ValueError):validate(data)

    def test_unspent_is_observation_not_permanent(self):
        data=fixture();data['outspends']=[{'spent':False}];data['spendingTransactions']=[]
        self.assertEqual(len(investigate(data)['edges']),2)
        data['outspends'][0]['txid']='2'*64
        with self.assertRaises(ValueError):validate(data)

    def test_caps_and_wrong_network(self):
        data=fixture();data['transaction']['vout']*=21
        with self.assertRaises(ValueError):validate(data)
        data=fixture();data['genesisHash']='0'*64
        with self.assertRaises(ValueError):validate(data)

    def test_capture_allowlisted_bounded_reads_and_projection(self):
        data=fixture();a=data['transaction']['txid'];b=data['spendingTransactions'][0]['txid'];calls=[]
        responses={'/block-height/0':GENESIS,'/tx/'+a:data['transaction'],'/tx/'+a+'/outspends':data['outspends'],'/tx/'+b:data['spendingTransactions'][0]}
        data['transaction']['providerSecret']='not-retained'
        def transport(endpoint,path):calls.append(path);return responses[path]
        bundle=capture(a,'https://provider.invalid',transport)
        self.assertEqual(len(calls),4);self.assertNotIn('providerSecret',bundle['transaction'])
        self.assertFalse(bundle['syntheticExample'])
        responses['/block-height/0']='0'*64
        with self.assertRaises(ValueError):capture(a,'https://provider.invalid',transport)

    def test_saved_mainnet_reproduces_and_report_is_exact(self):
        root=Path(__file__).resolve().parents[1]
        bundle=load(root/'examples/bitcoin-utxo.mainnet.json')
        self.assertEqual(investigate(bundle),load(root/'examples/bitcoin-investigation.mainnet.json'))
        self.assertEqual(report(bundle),(root/'docs/BITCOIN-EXAMPLE.md').read_text())
        self.assertEqual(len(bundle['outspends']),2)

    def test_confirmation_order(self):
        data=fixture();confirmed={'confirmed':True,'block_hash':'4'*64,'block_height':1,'block_time':1}
        data['spendingTransactions'][0]['status']=confirmed;data['outspends'][0]['status']=confirmed
        with self.assertRaises(ValueError):validate(data)

    def test_transport_rejects_non_https_and_arbitrary_paths(self):
        for endpoint,path in [('http://provider.invalid','/block-height/0'),
                              ('https://user:password@provider.invalid','/block-height/0'),
                              ('https://provider.invalid','/tx'),
                              ('https://provider.invalid?secret=x','/block-height/0')]:
            with self.assertRaises(ValueError):read(endpoint,path)

    def test_wrong_returned_transaction(self):
        data=fixture()
        def transport(endpoint,path):return GENESIS if path=='/block-height/0' else data['transaction']
        with self.assertRaises(ValueError):capture('9'*64,'https://provider.invalid',transport)


if __name__=='__main__':unittest.main()
