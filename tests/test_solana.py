import json,unittest,copy
from pathlib import Path
from solana import GENESIS,SYSTEM,TOKEN,project,capture,history,rpc,CONFIG,amount

def encoded(raw):
 alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';n=int.from_bytes(raw,'big');out=''
 while n:n,r=divmod(n,58);out=alphabet[r]+out
 return '1'*(len(raw)-len(raw.lstrip(b'\0')))+out
A,B,M=[encoded(bytes([n])*32) for n in (1,2,3)]
SIG=encoded(bytes(range(64)))

def raw():
 accounts=[A,B,M,SYSTEM,TOKEN]
 native={'programId':SYSTEM,'parsed':{'type':'transfer','info':{'source':A,'destination':B,'lamports':123456789}}}
 token={'programId':TOKEN,'parsed':{'type':'transferChecked','info':{'source':A,'destination':B,'mint':M,'tokenAmount':{'amount':'18446744073709551615','decimals':9,'uiAmount':'ignored'}}}}
 return {'slot':1,'blockTime':1700000000,'version':0,'meta':{'fee':5000,'err':None,'preBalances':[9007199254740993,0,0,0,0],'postBalances':[9007199254735993,0,0,0,0],
    'innerInstructions':[{'index':0,'instructions':[token]}],'preTokenBalances':[],'postTokenBalances':[]},
    'transaction':{'signatures':[SIG],'message':{'accountKeys':[{'pubkey':a,'signer':i==0,'writable':i<2} for i,a in enumerate(accounts)],'instructions':[native,token,{'programId':SYSTEM,'parsed':{'type':'createAccount','info':{'privateDiagnostic':'ignored'}}}]}}}

def synthetic(failed=False):
 row=raw()
 if failed:row['meta']['err']={'InstructionError':[1,'InvalidArgument']}
 result=project(row,SIG,'2026-10-23T00:00:00+00:00');result['syntheticExample']=True;return result

class SolanaCaptureTests(unittest.TestCase):
 def test_exact_u64_projection_and_diagnostic_redaction(self):
  d=synthetic();self.assertEqual(d['accounts'][0]['preLamports'],'9007199254740993');self.assertEqual(d['topInstructions'][1]['amount'],'18446744073709551615')
  self.assertNotIn('privateDiagnostic',json.dumps(d));self.assertNotIn('uiAmount',json.dumps(d))
 def test_capture_checks_genesis_and_signature(self):
  def transport(endpoint,method,params):return GENESIS if method=='getGenesisHash' else raw()
  self.assertEqual(capture(SIG,'https://provider.invalid',transport)['signature'],SIG)
  with self.assertRaises(ValueError):capture(encoded(b'\x09'*64),'https://provider.invalid',transport)
  with self.assertRaises(ValueError):capture(SIG,'https://provider.invalid',lambda *args:'wrong-network')
 def test_unsupported_program_never_becomes_token_transfer(self):
  r=raw();r['transaction']['message']['instructions'][1]['programId']=M
  self.assertEqual(project(r,SIG)['topInstructions'][1]['kind'],'unsupported')
 def test_wrong_accounts_null_meta_and_bad_version(self):
  for mutate in [lambda r:r.update(meta=None),lambda r:r.update(version=1),lambda r:r['meta']['preBalances'].pop(),lambda r:r['transaction']['message']['instructions'][0]['parsed']['info'].update(destination=encoded(b'\x07'*32))]:
   r=raw();mutate(r)
   with self.assertRaises((ValueError,TypeError)):project(r,SIG)
 def test_amount_bounds(self):
  for v in [True,-1,1.1,2**64,'01','1e9']:
   with self.assertRaises(ValueError):amount(v)
 def test_duplicate_inner_indices_rejected(self):
  r=raw();r['meta']['innerInstructions']*=2
  with self.assertRaises(ValueError):project(r,SIG)
 def test_unchecked_mint_conflict_rejected(self):
  r=raw();r['transaction']['message']['instructions'][1]['parsed']={'type':'transfer','info':{'source':A,'destination':B,'amount':'9'}}
  r['meta']['preTokenBalances']=[{'accountIndex':0,'mint':M},{'accountIndex':1,'mint':B}]
  with self.assertRaises(ValueError):project(r,SIG)
 def test_history_page_bound_projection_and_cursor(self):
  calls=[]
  def transport(endpoint,method,params):
   calls.append((method,params))
   return GENESIS if method=='getGenesisHash' else [{'signature':SIG,'slot':1,'err':None,'blockTime':None,'confirmationStatus':'finalized','memo':'PRIVATE IGNORE'}]
  d=history(A,'https://provider.invalid',encoded(b'\x08'*64),transport)
  self.assertEqual(d['nextBefore'],SIG);self.assertFalse(d['pageCapReached']);self.assertNotIn('memo',json.dumps(d));self.assertEqual(calls[1][1][1]['limit'],5)
 def test_history_cap_and_duplicates_rejected(self):
  item={'signature':SIG,'slot':1,'err':None,'blockTime':None,'confirmationStatus':'finalized'}
  for rows in [[item]*6,[item]*2]:
   with self.assertRaises(ValueError):history(A,'https://provider.invalid',transport=lambda e,m,p:GENESIS if m=='getGenesisHash' else rows)
 def test_unsafe_provider_and_methods_rejected_before_network(self):
  for endpoint,method,params in [('http://provider.invalid','getGenesisHash',[]),('https://provider.invalid','sendTransaction',[]),('https://provider.invalid','getTransaction',[SIG,{'encoding':'base64'}])]:
   with self.assertRaises(ValueError):rpc(endpoint,method,params)

if __name__=='__main__':unittest.main()
