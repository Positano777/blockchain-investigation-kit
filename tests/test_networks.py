import json,unittest
from pathlib import Path
from unittest.mock import patch
from capture_assets import capture_transaction,capture_record,discover
from networks import NETWORKS,network
ROOT=Path(__file__).resolve().parents[1]

class NetworkCaptureTests(unittest.TestCase):
 def test_registry_unique_and_provider_variables_have_no_endpoints(self):
  self.assertEqual(len(NETWORKS),11);self.assertEqual(len({p['chainId'] for p in NETWORKS}),11)
  self.assertEqual(len({p['rpcEnv'] for p in NETWORKS}),11)
  for p in NETWORKS:self.assertTrue(p['rpcEnv'].endswith('_RPC_URL'));self.assertTrue(p['explorerTx'].startswith('https://'))
 def test_wrong_chain_rejected_before_transaction_access(self):
  calls=[]
  def transport(endpoint,method,params):calls.append(method);return '0x1'
  with self.assertRaises(ValueError):capture_transaction('https://provider.invalid',56,'0x'+'1'*64,transport=transport)
  self.assertEqual(calls,['eth_chainId'])
 def test_unknown_chains_and_invalid_bounds_never_contact_provider(self):
  def transport(*args):self.fail('Unexpected network read')
  for chain in [True,999999]:
   with self.assertRaises(ValueError):capture_transaction('https://provider.invalid',chain,'0x'+'1'*64,transport=transport)
  with self.assertRaises(ValueError):discover('https://provider.invalid',56,'0x'+'1'*40,True,3,transport=transport)
 def test_capture_preserves_chain_and_checks_selected_network(self):
  profile=network(56);fixture=json.loads((ROOT/'examples/evm-bsc.mainnet.json').read_text());record=fixture['records'][0]
  def transport(endpoint,method,params):
   return {'eth_chainId':hex(profile['chainId']),'eth_getTransactionByHash':record['transaction'],'eth_getTransactionReceipt':record['receipt'],'eth_getBlockByHash':record['block']}[method]
  self.assertEqual(capture_transaction('https://provider.invalid',56,record['transaction']['hash'],transport=transport),fixture)
 def test_explicit_alternative_fee_currency_rejected(self):
  fixture=json.loads((ROOT/'examples/evm-celo.mainnet.json').read_text());record=fixture['records'][0]
  tx=dict(record['transaction'],feeCurrency='0x'+'1'*40)
  def transport(endpoint,method,params):return tx if method=='eth_getTransactionByHash' else record['receipt']
  with self.assertRaisesRegex(ValueError,'fee-currency'):capture_record('https://provider.invalid',tx['hash'],transport=transport)

if __name__=='__main__':unittest.main()
