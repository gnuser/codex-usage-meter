"""Windows-only process/window geometry; no UI content or screenshots."""
import sys
from pathlib import Path


def bottom_right(bounds, work_area, width, height, margin=12):
    left, top, right, bottom = bounds
    work_left, work_top, work_right, work_bottom = work_area
    return (max(work_left, min(right-width-margin, work_right-width)),
            max(work_top, min(bottom-height-margin, work_bottom-height)))


def codex_window_position(width=260, height=170):
    """Find the frontmost Codex window bounds without inspecting its contents."""
    if sys.platform != 'win32':
        return None
    import ctypes
    from ctypes import wintypes
    user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.IsWindowVisible.argtypes = [wintypes.HWND]
    user32.IsIconic.argtypes = [wintypes.HWND]
    user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    class MonitorInfo(ctypes.Structure):
        _fields_ = [('size', wintypes.DWORD), ('monitor', wintypes.RECT),
                    ('work', wintypes.RECT), ('flags', wintypes.DWORD)]
    user32.MonitorFromWindow.argtypes = [wintypes.HWND, wintypes.DWORD]
    user32.MonitorFromWindow.restype = wintypes.HANDLE
    user32.GetMonitorInfoW.argtypes = [wintypes.HANDLE, ctypes.POINTER(MonitorInfo)]
    found = []
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    @callback_type
    def visit(hwnd, _):
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
            return True
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        handle = kernel32.OpenProcess(0x1000, False, pid.value)
        if not handle:
            return True
        try:
            name, size = ctypes.create_unicode_buffer(32768), wintypes.DWORD(32768)
            if not kernel32.QueryFullProcessImageNameW(handle, 0, name, ctypes.byref(size)):
                return True
            if Path(name.value).name.lower() != 'codex.exe':
                return True
            rect = wintypes.RECT()
            if user32.GetWindowRect(hwnd, ctypes.byref(rect)) and rect.right-rect.left >= 400 and rect.bottom-rect.top >= 300:
                info = MonitorInfo()
                info.size = ctypes.sizeof(info)
                monitor = user32.MonitorFromWindow(hwnd, 2)
                if not user32.GetMonitorInfoW(monitor, ctypes.byref(info)):
                    return True
                work = info.work
                found.append(bottom_right(
                    (rect.left, rect.top, rect.right, rect.bottom),
                    (work.left, work.top, work.right, work.bottom), width, height))
                return False
        finally:
            kernel32.CloseHandle(handle)
        return True
    user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]
    user32.EnumWindows(visit, 0)
    return found[0] if found else None
