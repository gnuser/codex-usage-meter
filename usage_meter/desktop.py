"""Small platform boundary for desktop paths, locks and subprocesses."""
from contextlib import contextmanager
import os
from pathlib import Path
import subprocess
import sys
import time


def is_windows():
    return sys.platform == 'win32'


def runtime_dir():
    override = os.environ.get('CODEX_USAGE_DATA')
    if override:
        return Path(override)
    if is_windows():
        return Path(os.environ.get('LOCALAPPDATA') or Path.home() / 'AppData/Local') / 'CodexUsageMeter'
    return Path.home() / 'Library/Application Support/CodexUsageMeter'


def background_options():
    if is_windows():
        return {'creationflags': getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000)}
    return {'start_new_session': True}


def python_command(executable=None):
    executable = Path(executable or sys.executable)
    windowless = executable.with_name('pythonw.exe')
    return str(windowless if is_windows() and windowless.is_file() else executable)


@contextmanager
def file_lock(path, blocking=True):
    """Lock one byte on Windows; flock on Unix. Never truncate a live lock file."""
    stream = open(path, 'a+b')
    acquired = False
    try:
        if is_windows():
            import msvcrt
            if os.fstat(stream.fileno()).st_size == 0:
                stream.write(b'\0'); stream.flush()
            while True:
                stream.seek(0)
                try:
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                    acquired = True
                    break
                except OSError as exc:
                    if exc.errno not in (13, 11, 36):
                        raise
                    if not blocking:
                        raise BlockingIOError('Desktop lock is held') from exc
                    time.sleep(.05)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX | (0 if blocking else fcntl.LOCK_NB))
            acquired = True
        yield
    finally:
        if acquired:
            if is_windows():
                stream.seek(0); msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)
        stream.close()
