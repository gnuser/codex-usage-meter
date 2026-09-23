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
from native.windows import Bridge, Desktop, main


def smoke():
    import webview
    loaded, opened, titled = threading.Event(), threading.Event(), threading.Event()
    sized = threading.Event()
    failures = []
    identifier = '00000000-0000-0000-0000-000000000001'
    start = webview.start

    fit_height = Bridge.fit_height
    def capture_height(bridge, *args):
        result = fit_height(bridge, *args)
        if 100 <= bridge._window.height <= 480:
            sized.set()
        return result

    set_title = Bridge.set_title
    def capture_title(bridge, title):
        result = set_title(bridge, title)
        if title.startswith('Week '):
            titled.set()
        return result

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
                if not titled.wait(15):
                    raise AssertionError('Quota module or native title bridge failed')
                if not sized.wait(15):
                    raise AssertionError('Content height bridge failed')
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
            with patch('meter.account_snapshot', return_value=account), patch.object(Bridge, 'fit_height', capture_height), patch.object(Bridge, 'set_title', capture_title), patch.object(os, 'startfile', capture), \
                 patch.object(webview, 'start', checked_start), patch.object(Desktop, 'closing', return_value=True):
                main(folder)
        finally:
            service.close()
    if failures:
        raise AssertionError('; '.join(failures))
    print('WebView2 page load and native conversation bridge passed')


if __name__ == '__main__':
    smoke()
