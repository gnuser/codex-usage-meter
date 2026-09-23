import AppKit

enum WindowPlacement {
    private static func overlap(_ screen: NSRect, _ window: NSRect) -> CGFloat {
        let rect = screen.intersection(window)
        return rect.isNull ? 0 : rect.width * rect.height
    }

    static func place(_ panel: NSPanel) {
        // Window bounds only; no screen capture or conversation content is read.
        let applications = NSWorkspace.shared.runningApplications.filter {
            ["com.openai.codex", "com.openai.chat"].contains($0.bundleIdentifier ?? "") ||
            ["Codex", "ChatGPT"].contains($0.localizedName ?? "")
        }
        let codex = applications.filter { $0.bundleIdentifier == "com.openai.codex" || $0.localizedName == "Codex" }
        let pids = Set((codex.isEmpty ? applications : codex).map { $0.processIdentifier })
        let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
        let desktopTop = NSScreen.screens.first?.frame.maxY ?? 0
        var target: NSRect?
        for info in windows {
            guard let pid = info[kCGWindowOwnerPID as String] as? Int32, pids.contains(pid),
                  (info[kCGWindowLayer as String] as? Int) == 0,
                  let bounds = info[kCGWindowBounds as String] as? [String: Any],
                  let rect = CGRect(dictionaryRepresentation: bounds as CFDictionary),
                  rect.width >= 400, rect.height >= 300 else { continue }
            target = NSRect(x: rect.minX, y: desktopTop - rect.maxY, width: rect.width, height: rect.height)
            break
        }
        let screen = target.flatMap { rect in
            NSScreen.screens.max { overlap($0.frame, rect) < overlap($1.frame, rect) }
        } ?? NSScreen.main
        guard let visible = screen?.visibleFrame else { return }
        let anchor = target ?? visible
        let x = max(visible.minX, min(anchor.maxX - panel.frame.width - 12, visible.maxX - panel.frame.width))
        let y = max(visible.minY, min(anchor.minY + 12, visible.maxY - panel.frame.height))
        panel.setFrameOrigin(NSPoint(x: x, y: y))
    }
}
