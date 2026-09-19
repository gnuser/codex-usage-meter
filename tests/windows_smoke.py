"""CI smoke: real WebView2 + JS bridge, synthetic logs, no Codex launch/account query."""
import os
from pathlib import Path
import sys
import tempfile
import threading
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from floating import atomic_json
from meter import Service
from native.windows import Desktop, main


def smoke():
    import webview
    loaded, opened = threading.Event(), threading.Event()
    failures = []
    identifier = '00000000-0000-0000-0000-000000000001'
    start = webview.start

    def capture(url):
        if url == 'codex://threads/' + identifier:
            opened.set()

    def checked_start(func=None, **kwargs):
        window = webview.windows[-1]
        window.events.loaded += loaded.set
        def check():
            try:
                if func:
                    func()
                if not loaded.wait(40):
                    raise AssertionError('WebView2 page did not load')
                window.run_js("const probe=setInterval(()=>{if(window.pywebview?.api?.open_thread){clearInterval(probe);window.pywebview.api.open_thread('" + identifier + "');}},100);")
                if not opened.wait(15):
                    raise AssertionError('Page-to-native conversation bridge failed')
            except Exception as exc:
                failures.append(str(exc))
            finally:
                window.destroy()
        start(check, **kwargs)

    with tempfile.TemporaryDirectory() as name:
        folder = Path(name)
        service = Service(folder)
        try:
            atomic_json(folder/'connection.json', {'url':service.dashboard()})
            account = {'limits':None, 'usage':None, 'errors':{}, 'fetchedAt':0}
            with patch('meter.account_snapshot', return_value=account), patch.object(os, 'startfile', capture), \
                 patch.object(webview, 'start', checked_start), patch.object(Desktop, 'closing', return_value=True):
                main(folder)
        finally:
            service.close()
    if failures:
        raise AssertionError('; '.join(failures))
    print('WebView2 page load and native conversation bridge passed')


if __name__ == '__main__':
    smoke()
