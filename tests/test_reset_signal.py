import unittest

from usage_meter.reset_signal import assess


class PublicPostTests(unittest.TestCase):
    def post(self, text, age=0):
        return {'id': '1', 'text': text, 'publishedAt': 1000000 - age}

    def test_conservative_signal_and_time(self):
        planned = assess([self.post('We will reset Codex limits tomorrow.')], 1000000)
        self.assertEqual(planned['state'], 'announced')
        self.assertIn('tomorrow', planned['timeHint'])
        self.assertIn('not converted', planned['timeHint'])
        self.assertEqual(assess([self.post('We have reset Codex usage limits.')], 1000000)['state'], 'reported')
        self.assertEqual(assess([self.post('We will not reset Codex limits tomorrow.')], 1000000)['state'], 'unknown')
        self.assertEqual(assess([self.post('Will we reset Codex limits?')], 1000000)['state'], 'unknown')
        self.assertEqual(assess([self.post('A great new model!')], 1000000)['state'], 'unknown')
        self.assertEqual(assess([self.post('We will reset Codex tomorrow.', 4*86400)], 1000000)['state'], 'unknown')
        self.assertEqual(assess([self.post('No reset planned.'), self.post('We will reset tomorrow.')], 1000000)['state'], 'unknown')
        self.assertEqual(assess([self.post('I will reset my password tomorrow.')], 1000000)['state'], 'unknown')
        self.assertEqual(assess([self.post('Maybe we will reset Codex tomorrow.')], 1000000)['state'], 'possible')
        self.assertIn('18:00 UTC', assess([self.post('We will reset Codex tomorrow at 18:00 UTC.')], 1000000)['timeHint'])
        unrelated = [self.post('Great!')] * 3 + [self.post('We will reset tomorrow.')]
        self.assertEqual(assess(unrelated, 1000000)['state'], 'unknown')


if __name__ == '__main__': unittest.main()
