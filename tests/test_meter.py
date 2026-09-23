import io
from contextlib import closing
import json
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from usage_meter.ledger import FIELDS, Ledger, add, normalize_limits, parse, usage
from usage_meter.account import AppServer, account_snapshot
from meter import Service, dispatch


def tokens(i=100, o=20):
    return dict(zip(FIELDS, (i, i//2, 0, o, o//2, i+o)))


def event(total, last=None, stamp='2026-09-19T00:00:01Z'):
    return {'timestamp': stamp, 'type': 'event_msg', 'payload': {'type': 'token_count',
            'info': {'total_token_usage': total, 'last_token_usage': last or total}}}


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name)
        (self.home/'sessions').mkdir()
        self.path = self.home/'sessions/a.jsonl'

    def tearDown(self):
        self.temp.cleanup()

    def write(self, rows, path=None):
        (path or self.path).write_text(''.join(json.dumps(r)+'\n' for r in rows))

    def head(self, id='one'):
        return [{'type':'session_meta','payload':{'id':id, 'base_instructions':'SECRET_DO_NOT_EXPORT'}},
                {'type':'turn_context','payload':{'turn_id':'turn-1','model':'test-model'}}]

    def test_duplicate_snapshots_not_added(self):
        self.write(self.head()+[event(tokens()),event(tokens(),stamp='2026-09-19T00:00:02Z')])
        r=parse(self.path)
        self.assertEqual(len(r['events']),1)
        self.assertEqual(r['turns'][0]['usage']['total_tokens'],120)
        self.assertNotIn('SECRET_DO_NOT_EXPORT', json.dumps(r))

    def test_messages_link_to_turn_and_ignore_internal_content(self):
        def msg(role,text):
            return {'type':'response_item','payload':{'type':'message','role':role,'content':[{'type':'input_text','text':text}]}}
        self.write([{'type':'session_meta','payload':{'id':'one'}},
                    {'type':'event_msg','payload':{'type':'task_started','turn_id':'turn-1'}},
                    msg('user','修改标题'),msg('developer','PRIVATE SYSTEM'),
                    {'type':'event_msg','payload':{'type':'user_message','message':'修改标题'}},
                    msg('assistant','已修改'),event(tokens()),
                    {'type':'turn_context','payload':{'turn_id':'turn-2'}},msg('user','第二次请求')])
        r=parse(self.path,include_messages=True)
        self.assertEqual(r['title'],'修改标题')
        self.assertEqual([m['text'] for m in r['turns'][0]['messages']],['修改标题','已修改'])
        self.assertEqual(r['turns'][0]['usage']['total_tokens'],120)
        self.assertEqual(r['turns'][1]['preview'],'第二次请求')
        self.assertNotIn('PRIVATE SYSTEM',json.dumps(r))
        self.assertNotIn('messages',parse(self.path)['turns'][0])

    def test_title_metadata_and_selected_content(self):
        import sqlite3
        self.write(self.head()+[{'type':'event_msg','payload':{'type':'user_message','message':'原始请求'}},event(tokens())])
        with closing(sqlite3.connect(self.home/'state_5.sqlite')) as db, db:
            db.execute('CREATE TABLE threads (id TEXT, title TEXT, name TEXT)')
            db.execute('INSERT INTO threads VALUES (?,?,?)',('one','旧标题','重命名标题'))
        r=Ledger(self.home).snapshot('one')
        self.assertEqual(r['sessions'][0]['title'],'重命名标题')
        self.assertEqual(r['selected']['turns'][0]['messages'][0]['text'],'原始请求')
        self.assertNotIn('turns',r['sessions'][0])

    def test_pre_context_message_attached_and_repeated_user_preserved(self):
        message={'type':'response_item','payload':{'type':'message','role':'user','content':[{'type':'input_text','text':'重复'}]}}
        self.write([message,*self.head(),message,event(tokens())])
        r=parse(self.path,include_messages=True)
        self.assertEqual(len(r['turns'][0]['messages']),2)

    def test_identical_calls_with_new_total_are_counted(self):
        self.write(self.head()+[event(tokens()),event(tokens(200,40),tokens(),stamp='2026-09-19T00:00:02Z')])
        r=parse(self.path)
        self.assertEqual(len(r['events']),2)
        self.assertEqual(r['turns'][0]['usage']['total_tokens'],240)
        self.assertEqual(r['turns'][0]['usage']['cached_input_tokens'],100)

    def test_turns_separate_and_empty_current_turn_unknown(self):
        self.write(self.head()+[event(tokens()),{'type':'turn_context','payload':{'turn_id':'turn-2'}}])
        r=parse(self.path)
        self.assertIsNone(r['turns'][-1]['usage']['total_tokens'])
        self.assertEqual(r['turns'][0]['usage']['total_tokens'],120)

    def test_partial_history_only_attributes_last(self):
        self.write(self.head()+[event(tokens(1000,200), tokens())])
        r=parse(self.path)
        self.assertEqual(r['total']['total_tokens'],1200)
        self.assertEqual(r['turns'][0]['usage']['total_tokens'],120)
        self.assertTrue(r['warnings'])

    def test_gap_is_interval_not_single_call(self):
        self.write(self.head()+[event(tokens()),event(tokens(400,80),tokens(),stamp='2026-09-19T00:00:02Z')])
        e=parse(self.path)['events'][-1]
        self.assertEqual(e['quality'],'interval_delta')
        self.assertEqual(e['usage']['total_tokens'],360)
        self.assertEqual(e['lastReported']['total_tokens'],120)

    def test_cross_turn_gap_not_attributed_to_single_turn(self):
        self.write(self.head()+[event(tokens()),{'type':'turn_context','payload':{'turn_id':'turn-2'}},event(tokens(400,80),tokens(),stamp='2026-09-19T00:00:02Z')])
        r=parse(self.path)
        self.assertIsNone(r['events'][-1]['turnId'])
        self.assertIsNone(r['turns'][-1]['usage']['total_tokens'])

    def test_zero_initial_snapshot_is_not_a_request(self):
        self.write(self.head()+[event(tokens(0,0))])
        self.assertEqual(parse(self.path)['events'],[])

    def test_reset_not_negative(self):
        self.write(self.head()+[event(tokens(400,80)),event(tokens(),stamp='2026-09-19T00:00:02Z')])
        r=parse(self.path)
        self.assertEqual(len(r['events']),1)
        self.assertTrue(any('回退' in w for w in r['warnings']))

    def test_missing_optional_is_not_zero(self):
        t=tokens();del t['cache_write_input_tokens']
        self.write(self.head()+[event(t)])
        self.assertIsNone(parse(self.path)['total']['cache_write_input_tokens'])
        self.assertIsNone(add([usage(t),usage(tokens())])['cache_write_input_tokens'])
        self.assertIsNone(usage({'input_tokens': True})['input_tokens'])

    def test_unknown_schema_and_null_info(self):
        self.write(self.head()+[{'type':'event_msg','payload':{'type':'token_count','info':None}},event({})])
        r=parse(self.path)
        self.assertEqual(r['events'],[])
        self.assertTrue(r['warnings'])

    def test_partial_tail_retries_after_append_and_truncate(self):
        self.write(self.head())
        with self.path.open('a') as f:f.write(json.dumps(event(tokens())))
        ledger=Ledger(self.home)
        self.assertEqual(ledger.snapshot()['observedRecords'],0)
        with self.path.open('a') as f:f.write('\n')
        self.assertEqual(ledger.snapshot()['observedRecords'],1)
        self.write(self.head())
        self.assertEqual(ledger.snapshot()['observedRecords'],0)

    def test_corrupt_line_does_not_drop_following_events(self):
        self.write(self.head())
        with self.path.open('a') as f:f.write('broken\n'+json.dumps(event(tokens()))+'\n')
        self.assertEqual(len(parse(self.path)['events']),1)

    def test_archives_forks_and_missing_selection(self):
        rows=self.head()+[event(tokens())];self.write(rows)
        (self.home/'archived_sessions').mkdir()
        self.write(rows,self.home/'archived_sessions/a.jsonl')
        self.write(self.head('fork')+[event(tokens())],self.home/'sessions/b.jsonl')
        r=Ledger(self.home).snapshot('nonexistent', limit=10)
        self.assertEqual(len(r['sessions']),2)
        self.assertEqual(r['observedTotal']['total_tokens'],120)
        self.assertIsNone(r['selected'])

    def test_lazy_loading_only_opens_requested_sessions(self):
        import os
        for i in range(8):
            path=self.home/'sessions'/f'{i}.jsonl'
            self.write(self.head(str(i))+[event(tokens())],path)
            os.utime(path,(100+i,100+i))
        ledger=Ledger(self.home)
        with patch('usage_meter.ledger.parse',wraps=parse) as reader:
            r=ledger.snapshot()
            self.assertEqual([s['id'] for s in r['sessions']],['7'])
            self.assertEqual({c.args[0].name for c in reader.call_args_list},{'7.jsonl'})
            self.assertEqual(r['selectedId'],'7')
            self.assertTrue(r['pagination']['hasMore'])
            reader.reset_mock()
            r=ledger.snapshot(limit=4)
            self.assertEqual([s['id'] for s in r['sessions']],['7','6','5','4'])
            self.assertFalse({'0.jsonl','1.jsonl','2.jsonl','3.jsonl'} & {c.args[0].name for c in reader.call_args_list})
            reader.reset_mock()
            ledger.snapshot(limit=4)
            self.assertEqual({c.args[0].name for c in reader.call_args_list},{'7.jsonl'})
            self.assertFalse(ledger.snapshot(limit=10)['pagination']['hasMore'])

    def test_exact_selection_ignores_newer_unrelated_logs_and_messages(self):
        target = self.home/'sessions/rollout-one.jsonl'
        self.write(self.head()+[event(tokens()), {'type':'turn_context','payload':{'turn_id':'new-turn'}}], target)
        self.write(self.head('other')+[event(tokens(900,20))])
        with patch('usage_meter.ledger.parse', wraps=parse) as reader:
            result = Ledger(self.home).snapshot('one', exact=True, include_messages=False)
            self.assertEqual({c.args[0] for c in reader.call_args_list}, {target})
        self.assertEqual(result['selected']['id'], 'one')
        self.assertEqual(result['selected']['total']['total_tokens'], 120)
        self.assertIsNone(result['selected']['turns'][-1]['usage']['total_tokens'])
        self.assertNotIn('messages', result['selected']['turns'][0])
        self.assertIsNone(Ledger(self.home).snapshot('missing', exact=True)['selected'])
        self.write(self.head('wrong')+[event(tokens())], target)
        self.assertIsNone(Ledger(self.home).snapshot('one', exact=True)['selected'])
        for identifier in (None, '', '../one', '*'):
            with self.assertRaises(ValueError): Ledger(self.home).snapshot(identifier, exact=True)

    def test_alternating_panels_reuse_cache_and_reread_modified_logs(self):
        first = self.home/'sessions/rollout-one.jsonl'
        second = self.home/'sessions/rollout-two.jsonl'
        self.write(self.head('one')+[event(tokens())], first)
        self.write(self.head('two')+[event(tokens())], second)
        ledger = Ledger(self.home)
        with patch('usage_meter.ledger.parse', wraps=parse) as reader:
            for identifier in ('one', 'two', 'one', 'two'):
                ledger.snapshot(identifier, exact=True, include_messages=False)
            self.assertEqual(reader.call_count, 2)
            self.write(self.head('one')+[event(tokens(999, 22))], first)
            result = ledger.snapshot('one', exact=True, include_messages=False)
            self.assertEqual(reader.call_count, 3)
            self.assertEqual(result['selected']['total']['total_tokens'], 1021)

    def test_catalog_only_reads_metadata_and_deduplicates_archives(self):
        import os
        first='00000000-0000-0000-0000-000000000001'
        second='00000000-0000-0000-0000-000000000002'
        for identifier, stamp in ((first,100),(second,200)):
            path=self.home/'sessions'/('rollout-'+identifier+'.jsonl')
            path.write_text('PRIVATE INVALID BODY')
            os.utime(path,(stamp,stamp))
        archive=self.home/'archived_sessions';archive.mkdir()
        copy=archive/('rollout-'+first+'.jsonl');copy.write_text('PRIVATE COPY');os.utime(copy,(50,50))
        (self.home/'session_index.jsonl').write_text(json.dumps({'id':second,'thread_name':'第二个任务'})+'\n')
        with patch('usage_meter.ledger.parse',side_effect=AssertionError('Must not parse logs')):
            result=Ledger(self.home).catalog(1)
            self.assertEqual(result['sessions'][0]['id'],second)
            self.assertEqual(result['sessions'][0]['title'],'第二个任务')
            self.assertTrue(result['hasMore'])
            self.assertEqual(len(Ledger(self.home).catalog(10)['sessions']),2)
            self.assertNotIn('PRIVATE',json.dumps(result))
        import sqlite3
        with closing(sqlite3.connect(self.home/'state_5.sqlite')) as db, db:
            db.execute('CREATE TABLE threads(id TEXT, source TEXT, title TEXT)')
            db.execute('INSERT INTO threads VALUES(?,?,?)',(second,'{"subagent":{"other":"guardian"}}','INTERNAL'))
        self.assertEqual([s['id'] for s in Ledger(self.home).catalog()['sessions']],[first])
        with self.assertRaises(ValueError):Ledger(self.home).catalog(101)

    def test_invalid_load_limit_rejected(self):
        for value in (0,-1,1001,True,'4'):
            with self.assertRaises(ValueError):Ledger(self.home).snapshot(limit=value)

    def test_model_breakdown_and_ambiguous_gap(self):
        self.write(self.head()+[event(tokens()),
            {'type':'turn_context','payload':{'turn_id':'turn-1','model':'second-model'}},
            event(tokens(200,40),tokens(),stamp='2026-09-19T00:00:02Z'),
            event(tokens(400,80),tokens(),stamp='2026-09-19T00:00:03Z')])
        r=parse(self.path,True)
        by_model={m['model']:m['usage']['total_tokens'] for m in r['models']}
        self.assertEqual(by_model,{'test-model':120,'second-model':120,'模型未知 / 区间无法归因':240})
        self.assertEqual(r['observedUsage']['total_tokens'],480)
        self.assertEqual(r['turns'][0]['models'],r['models'])

    def test_empty_home_and_removed_file(self):
        ledger=Ledger(self.home);self.write(self.head()+[event(tokens())]);ledger.snapshot()
        self.path.unlink()
        r=ledger.snapshot()
        self.assertEqual(r['files'],0)
        self.assertIsNone(r['observedTotal']['total_tokens'])


class LimitsTests(unittest.TestCase):
    def test_multiple_buckets_and_nulls(self):
        r=normalize_limits({'rateLimits':{'primary':{'usedPercent':99}},'rateLimitsByLimitId':{
          'a':{'primary':{'usedPercent':25,'resetsAt':100},'secondary':None},
          'b':{'primary':{'usedPercent':None}}}})
        self.assertEqual(r[0]['remainingPercent'],75)
        self.assertEqual(r[0]['resetsAt'],100)
        self.assertIsNone(r[1]['remainingPercent'])

    def test_legacy_limits_and_clamping(self):
        self.assertEqual(normalize_limits({'limit_id':'codex','primary':{'used_percent':120}})[0]['remainingPercent'],0)
        self.assertEqual(normalize_limits({'rateLimits':{'primary':{'usedPercent':-4}}})[0]['remainingPercent'],100)
        self.assertEqual(normalize_limits(None),[])

    def test_account_partial_failure_and_cleanup(self):
        class Fake:
            closed=False
            def __init__(self,**kw):pass
            def request(self,m,p):
                if m=='account/usage/read':raise RuntimeError('unsupported')
                return {'rateLimits':None}
            def close(self):Fake.closed=True
        r=account_snapshot(factory=Fake)
        self.assertIsNotNone(r['limits'])
        self.assertIsNone(r['usage'])
        self.assertEqual(r['errors']['usage'],'unsupported')
        self.assertTrue(Fake.closed)

    def test_appserver_handshake_read_only_and_eof(self):
        code='''import sys,json
for line in sys.stdin:
 r=json.loads(line)
 if 'id' in r: print(json.dumps({'id':r['id'],'result':{'ok':True}}),flush=True)
'''
        client=AppServer([sys.executable,'-u','-c',code],timeout=2)
        try:
            self.assertEqual(client.request('account/rateLimits/read'),{'ok':True})
            with self.assertRaises(ValueError):client.request('account/logout')
        finally:client.close()
        with self.assertRaises(RuntimeError):AppServer([sys.executable,'-c','pass'],timeout=.5)

    def test_appserver_timeout_cleanup(self):
        with self.assertRaises(RuntimeError):
            AppServer([sys.executable,'-c','import time;time.sleep(10)'],timeout=.1)


class IntegrationTests(unittest.TestCase):
    def test_packaged_mcp_launcher(self):
        root=Path(__file__).resolve().parents[1]
        config=json.loads((root/'.mcp.json').read_text())['mcpServers']['usage-meter']
        if sys.platform == 'win32':
            config.update(command=sys.executable, args=[str(root/'meter.py'), 'mcp'])
        p=subprocess.run([config['command'],*config['args']],cwd=root/config['cwd'],
                         input='{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n',
                         text=True,capture_output=True,timeout=5)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual(len(json.loads(p.stdout)['result']['tools']),3)

    def test_personal_install_preserves_marketplace_and_refuses_overwrite(self):
        from install import install
        with tempfile.TemporaryDirectory() as folder:
            home=Path(folder);p=home/'.agents/plugins/marketplace.json';p.parent.mkdir(parents=True)
            original={'name':'my-personal','interface':{'displayName':'Keep me'},'plugins':[{'name':'existing'}]}
            p.write_text(json.dumps(original))
            target,market,name=install(Path(__file__).resolve().parents[1],home)
            result=json.loads(market.read_text())
            self.assertEqual(name,'my-personal')
            self.assertEqual(result['interface'],original['interface'])
            self.assertEqual(result['plugins'][0],original['plugins'][0])
            self.assertTrue((target/'meter.py').exists())
            self.assertEqual(result['plugins'][-1]['source']['path'],'./plugins/codex-usage-meter')
            with self.assertRaises(FileExistsError):install(target,home)

    def test_http_auth_host_and_routes(self):
        with tempfile.TemporaryDirectory() as home:
            s=Service(home);url=s.dashboard('one').split('#')[0]
            try:
                self.assertIn('Codex',urlopen(url).read().decode())
                with self.assertRaises(HTTPError) as c:urlopen(url+'api/snapshot')
                self.assertEqual(c.exception.code,401)
                req=Request(url+'api/snapshot',headers={'Authorization':'Bearer '+s.token})
                self.assertEqual(json.load(urlopen(req))['files'],0)
                req=Request(url,headers={'Host':'evil.test'})
                with self.assertRaises(HTTPError) as c:urlopen(req)
                self.assertEqual(c.exception.code,403)
                with self.assertRaises(HTTPError):urlopen(url+'../meter.py')
            finally:s.close()

    def test_panel_routes_and_explicit_binding(self):
        with tempfile.TemporaryDirectory() as home:
            root = Path(home)/'sessions'; root.mkdir()
            rows = [{'type':'session_meta','payload':{'id':'one'}}]
            for i in range(12):
                rows.extend([{'type':'turn_context','payload':{'turn_id':str(i)}}, event(tokens((i+1)*100,(i+1)*20), tokens(), str(i))])
            (root/'rollout-one.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in rows))
            service = Service(home)
            try:
                with self.assertRaises(ValueError): service.dashboard(view='panel')
                response = dispatch(service, {'method':'tools/call', 'params':{'name':'usage_dashboard','arguments':{'thread_id':'one','view':'panel'}}})
                url = response['structuredContent']['url']
                self.assertIn('/panel#', url)
                base = url.split('/panel#')[0]
                self.assertIn('活跃会话用量', urlopen(base+'/panel').read().decode())
                req = lambda path: Request(base+path, headers={'Authorization':'Bearer '+service.token})
                with self.assertRaises(HTTPError): urlopen(base+'/api/panel?thread=one')
                with self.assertRaises(HTTPError): urlopen(req('/api/panel'))
                data = json.load(urlopen(req('/api/panel?thread=one')))
                self.assertEqual([t['number'] for t in data['selected']['turns']], list(range(3,13)))
                self.assertNotIn('events', data['selected'])
                self.assertIsInstance(data['selected']['models'], list)
                self.assertTrue(urlopen(base+'/quota-summary.js').read())
                self.assertTrue(urlopen(base+'/tibo.js').read())
                self.assertTrue(urlopen(base+'/panel-size.js').read())
                with self.assertRaises(HTTPError): urlopen(base+'/api/tibo')
                self.assertNotIn('messages', json.dumps(data))
                detail = json.load(urlopen(req('/api/snapshot?thread=one&scope=thread')))
                self.assertEqual(detail['selected']['id'], 'one')
            finally: service.close()

    def test_real_mcp_stdio(self):
        root=Path(__file__).resolve().parents[1]
        messages=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-03-26'}},
                  {'jsonrpc':'2.0','method':'notifications/initialized'},
                  {'jsonrpc':'2.0','id':2,'method':'tools/list'},
                  {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'usage_snapshot'}},
                  {'jsonrpc':'2.0','id':4,'method':'bad/method'}]
        with tempfile.TemporaryDirectory() as home:
            p=subprocess.run([sys.executable,str(root/'meter.py'),'--home',home,'mcp'],input=''.join(json.dumps(m)+'\n' for m in messages),capture_output=True,text=True,timeout=10)
        self.assertEqual(p.returncode,0,p.stderr)
        out=[json.loads(line) for line in p.stdout.splitlines()]
        self.assertEqual(len(out),4)
        self.assertEqual(out[0]['result']['protocolVersion'],'2025-03-26')
        self.assertEqual(len(out[1]['result']['tools']),3)
        self.assertEqual(out[2]['result']['structuredContent']['files'],0)
        self.assertEqual(out[3]['error']['code'],-32601)


if __name__=='__main__':unittest.main()
