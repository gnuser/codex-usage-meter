import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floating import select_session, launch
from native.install_hook import install


class FloatingTests(unittest.TestCase):
    def test_only_prompt_submission_switches_and_never_saves_prompt(self):
        with tempfile.TemporaryDirectory() as name:
            folder = Path(name)
            self.assertTrue(select_session({'hook_event_name':'UserPromptSubmit','session_id':'first','prompt':'PRIVATE'},folder,10))
            for kind in ('Stop','SessionStart','SubagentStop'):
                self.assertFalse(select_session({'hook_event_name':kind,'session_id':'other'},folder,20))
            self.assertFalse(select_session({'hook_event_name':'UserPromptSubmit','session_id':'old'},folder,9))
            self.assertEqual(json.loads((folder/'selection.json').read_text()),{'thread':'first','submittedAt':10})
            self.assertTrue(select_session({'hook_event_name':'UserPromptSubmit','session_id':'second'},folder,21))
            self.assertEqual(json.loads((folder/'selection.json').read_text())['thread'],'second')
            self.assertEqual((folder/'selection.json').stat().st_mode & 0o777,0o600)
            self.assertNotIn('PRIVATE',(folder/'selection.json').read_text())

    def test_invalid_session_does_not_write_or_launch(self):
        with tempfile.TemporaryDirectory() as name:
            folder=Path(name)
            for value in ('../path','','*',None,42):
                self.assertFalse(select_session({'hook_event_name':'UserPromptSubmit','session_id':value},folder))
            self.assertEqual(list(folder.iterdir()),[])
            with patch('floating.subprocess.Popen') as spawn:
                launch(folder)
                spawn.assert_not_called()
                binary=folder/'CodexUsageMeter.app/Contents/MacOS/CodexUsageMeter'
                binary.parent.mkdir(parents=True);binary.touch();(folder/'paused').touch()
                launch(folder)
                spawn.assert_not_called()

    def test_live_daemon_prevents_duplicate_launch(self):
        import fcntl
        with tempfile.TemporaryDirectory() as name:
            folder=Path(name)
            binary=folder/'CodexUsageMeter.app/Contents/MacOS/CodexUsageMeter'
            binary.parent.mkdir(parents=True);binary.touch()
            with (folder/'daemon.lock').open('a') as lock, patch('floating.subprocess.Popen') as spawn:
                fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
                launch(folder)
                spawn.assert_not_called()

    def test_hook_registration_preserves_existing_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as name:
            path=Path(name)/'hooks.json'
            existing={'description':'keep','hooks':{'Stop':[{'hooks':[{'type':'command','command':'existing'}]}], 'UserPromptSubmit':[{'hooks':[{'type':'command','command':'other'}]}]}}
            path.write_text(json.dumps(existing))
            install(path)
            result=json.loads(path.read_text())
            self.assertEqual(result['description'],'keep')
            self.assertEqual(result['hooks']['Stop'],existing['hooks']['Stop'])
            self.assertEqual(result['hooks']['UserPromptSubmit'][0],existing['hooks']['UserPromptSubmit'][0])
            self.assertEqual(len(result['hooks']['UserPromptSubmit']),2)
            install(path)
            self.assertEqual(json.loads(path.read_text()),result)
            backups=list(path.parent.glob('hooks.json.usage-meter-backup-*'))
            self.assertEqual(len(backups),1)
            self.assertEqual(json.loads(backups[0].read_text()),existing)

if __name__=='__main__':unittest.main()
