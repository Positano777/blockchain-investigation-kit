import copy
import unittest
from pathlib import Path
from capture_assets import capture_record,discover,project_trace
from collect import rpc
from kit import load

ROOT=Path(__file__).resolve().parents[1]


class AssetCapture(unittest.TestCase):
    def setUp(self):self.record=load(ROOT/'examples/assets.synthetic.json')['records'][0]

    def transport(self,endpoint,method,params):
        return {'eth_getTransactionByHash':self.record['transaction'],'eth_getTransactionReceipt':self.record['receipt'],'eth_getBlockByHash':self.record['block'],'eth_chainId':'0x1'}[method]

    def test_capture_projects_fields_and_marks_trace_failure(self):
        self.record['transaction']['provider_token']='secret'
        def read(endpoint,method,params):
            if method=='debug_traceTransaction':raise ValueError('secret')
            return self.transport(endpoint,method,params)
        result=capture_record('unused',self.record['transaction']['hash'],True,read)
        self.assertEqual(result['trace'],{'status':'unavailable','root':None})
        self.assertNotIn('provider_token',result['transaction'])

    def test_trace_projection_removes_diagnostics(self):
        raw={'type':'CALL','from':'0x'+'1'*40,'to':'0x'+'2'*40,'value':'0x1','error':'secret','revertReason':'secret','calls':[]}
        projected=project_trace(raw)
        self.assertTrue(projected['failed']);self.assertNotIn('error',projected);self.assertNotIn('revertReason',projected)

    def test_bounds_and_wrong_chain(self):
        for start,end in [(-1,0),(2,1),(1,21)]:
            with self.assertRaises(ValueError):discover('unused',1,'0x'+'1'*40,start,end,transport=self.transport)
        with self.assertRaises(ValueError):discover('unused',10,'0x'+'1'*40,1,1,transport=self.transport)

    def test_restricted_rpc_methods_and_trace_configuration(self):
        with self.assertRaises(ValueError):rpc('https://example.invalid','debug_traceTransaction',['0x'+'a'*64,{'tracer':'arbitrary javascript'}])
        with self.assertRaises(ValueError):rpc('https://example.invalid','eth_getBlockByNumber',['latest',True])

    def test_scan_stops_at_ten_and_reports_cap(self):
        address='0x'+'1'*40
        def read(endpoint,method,params):
            if method=='eth_chainId':return '0x1'
            if method=='eth_getBlockByNumber':number=int(params[0],16)
            elif method=='eth_getBlockByHash':number=int(params[0],16)
            else:number=int(params[0],16)
            tx_hash='0x'+format(number,'064x');bh='0x'+format(number,'064x')
            tx={'hash':tx_hash,'from':address,'to':'0x'+'2'*40,'value':'0x1','blockHash':bh,'blockNumber':hex(number),'transactionIndex':'0x0'}
            block={'hash':bh,'number':hex(number),'timestamp':'0x1','transactions':[tx] if method=='eth_getBlockByNumber' else [tx_hash]}
            if method in ['eth_getBlockByNumber','eth_getBlockByHash']:return block
            if method=='eth_getTransactionByHash':return tx
            return {'transactionHash':tx_hash,'from':address,'to':'0x'+'2'*40,'status':'0x1','blockHash':bh,'blockNumber':hex(number),'transactionIndex':'0x0','gasUsed':'0x1','effectiveGasPrice':'0x1','logs':[]}
        result=discover('unused',1,address,1,20,transport=read)
        self.assertEqual(len(result['records']),10);self.assertEqual(len(result['discovery']['scannedBlocks']),10);self.assertTrue(result['discovery']['limitReached'])

    def test_changed_block_fails_instead_of_merging_forks(self):
        def read(endpoint,method,params):
            if method=='eth_getBlockByNumber':
                return {'number':'0x64','hash':'0x'+'f'*64,'transactions':[self.record['transaction']]}
            return self.transport(endpoint,method,params)
        with self.assertRaises(ValueError):discover('unused',1,self.record['transaction']['from'],100,100,transport=read)

    def test_trace_budget_and_unsupported_missing_address(self):
        raw={'type':'CALL','from':'0x'+'1'*40,'to':'0x'+'2'*40,'calls':[]}
        with self.assertRaises(ValueError):project_trace(raw,33)
        raw['to']=None
        with self.assertRaises(ValueError):project_trace(raw)
