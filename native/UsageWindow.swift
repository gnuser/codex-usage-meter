import AppKit
import WebKit

final class PassiveUsageWebView: WKWebView {
    override var needsPanelToBecomeKey: Bool { false }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class UsageApp: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    let folder: URL
    var panel: NSPanel!
    var web: WKWebView!
    let titleLabel = NSTextField(labelWithString: "Codex 用量")
    let titleAccessory = NSTitlebarAccessoryViewController()
    var item: NSStatusItem!
    var statusMenu: NSMenu!
    var timer: Timer?
    var pinnedThread: String?
    var loadedMode = ""
    var selected = ""
    var connection = ""
    var lastPanelRefresh = Date.distantPast
    var showStamp: NSNumber?
    var lastActivityPoll = Date.distantPast
    var lastQuotaPoll = Date.distantPast
    var activityBusy = false
    var quotaBusy = false
    var activeCount: Int?
    var quotaWindows: [[String: Any]] = []
    init(folder: URL) { self.folder = folder; super.init() }
    func read(_ name: String) -> [String: Any] {
        guard let data = try? Data(contentsOf: folder.appendingPathComponent(name)),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return object
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 240, height: 115),
                        styleMask: [.titled, .closable, .miniaturizable, .resizable, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.title = "Codex 用量"
        panel.titleVisibility = .hidden
        titleLabel.font = .systemFont(ofSize: 9, weight: .regular)
        titleLabel.textColor = .secondaryLabelColor
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.alignment = .right
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        let titleContainer = NSView(frame: NSRect(x: 0, y: 0, width: 155, height: 22))
        titleContainer.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: titleContainer.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: titleContainer.trailingAnchor, constant: -7),
            titleLabel.centerYAnchor.constraint(equalTo: titleContainer.centerYAnchor)
        ])
        titleAccessory.view = titleContainer
        titleAccessory.layoutAttribute = .right
        panel.addTitlebarAccessoryViewController(titleAccessory)
        panel.isReleasedWhenClosed = false
        panel.hidesOnDeactivate = false
        panel.isFloatingPanel = true
        panel.becomesKeyOnlyIfNeeded = true
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.minSize = NSSize(width: 220, height: 100)
        panel.delegate = self
        // Both title-bar controls tuck the window into the status item, never the Dock.
        for kind in [NSWindow.ButtonType.zoomButton, .miniaturizeButton] {
            if let button = panel.standardWindowButton(kind) {
                button.target = self
                button.action = #selector(hideWindow)
                button.isEnabled = true
                button.toolTip = "收起到菜单栏"
                button.setAccessibilityLabel("收起到菜单栏")
            }
        }
        panel.setFrameAutosaveName("CodexUsageMeterTinyWindow")
        _ = panel.setFrameUsingName("CodexUsageMeterTinyWindow")
        WindowPlacement.place(panel)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.userContentController.add(self, name: "usageControl")
        pinnedThread = read("preferences.json")["pinnedThread"] as? String
        web = PassiveUsageWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        panel.contentView = web
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "▥ — · —"
        item.button?.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        item.button?.toolTip = "Codex 用量 · 点击展开/收起，右键显示菜单"
        item.button?.setAccessibilityLabel("Codex 用量：展开或收起")
        item.button?.target = self
        item.button?.action = #selector(statusClicked)
        item.button?.sendAction(on: [.leftMouseUp, .rightMouseUp])
        let menu = NSMenu()
        for (title, action) in [("显示用量窗口", #selector(showWindow)), ("收起到菜单栏", #selector(hideWindow)), ("退出并暂停自动打开", #selector(quitWindow))] {
            let entry = NSMenuItem(title: title, action: action, keyEquivalent: "")
            entry.target = self; menu.addItem(entry)
        }
        statusMenu = menu
        // Keep a visible window and Dock recovery path when the menu bar is crowded.
        showStamp = read("show.json")["at"] as? NSNumber
        tick()
        panel.orderFrontRegardless()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.tick() }
    }
    func tick() {
        refreshStatus()
        if panel.isVisible && Date().timeIntervalSince(lastPanelRefresh) >= 5 {
            lastPanelRefresh = Date()
            web.evaluateJavaScript("window.refreshUsage?.()", completionHandler: nil)
        }
        if let stamp = read("show.json")["at"] as? NSNumber, stamp != showStamp {
            showStamp = stamp
            panel.orderFrontRegardless()
        }
        guard let thread = pinnedThread ?? (read("selection.json")["thread"] as? String),
              thread.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil,
              let address = read("connection.json")["url"] as? String,
              var components = URLComponents(string: address), components.host == "127.0.0.1", components.scheme == "http",
              selected != thread || connection != address || loadedMode != (pinnedThread == nil ? "follow" : "pinned") else { return }
        var fragment = URLComponents()
        fragment.query = components.fragment
        guard let key = fragment.queryItems?.first(where: {$0.name == "key"})?.value else { return }
        fragment.queryItems = [URLQueryItem(name: "key", value: key), URLQueryItem(name: "thread", value: thread), URLQueryItem(name: "follow", value: "1"), URLQueryItem(name: "mode", value: pinnedThread == nil ? "follow" : "pinned")]
        components.path = "/panel"
        // A query change forces a new document; fragment-only navigation preserves old JS state.
        components.queryItems = [URLQueryItem(name: "thread", value: thread), URLQueryItem(name: "mode", value: pinnedThread == nil ? "follow" : "pinned")]
        components.fragment = fragment.query
        guard let url = components.url else { return }
        selected = thread; connection = address
        loadedMode = pinnedThread == nil ? "follow" : "pinned"
        web.load(URLRequest(url: url))
    }
    // Native polling continues while WKWebView is hidden or its timers are suspended.
    func statusRequest(_ path: String, completion: @escaping ([String: Any]?) -> Void) {
        guard let address = read("connection.json")["url"] as? String,
              var base = URLComponents(string: address), base.scheme == "http", base.host == "127.0.0.1" else {
            completion(nil); return
        }
        var fragment = URLComponents(); fragment.query = base.fragment
        guard let key = fragment.queryItems?.first(where: { $0.name == "key" })?.value else { completion(nil); return }
        let pieces = path.split(separator: "?", maxSplits: 1)
        base.path = String(pieces[0]); base.query = pieces.count > 1 ? String(pieces[1]) : nil; base.fragment = nil
        guard let url = base.url else { completion(nil); return }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 75)
        request.setValue("Bearer " + key, forHTTPHeaderField: "Authorization")
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let result: [String: Any]?
            if (response as? HTTPURLResponse)?.statusCode == 200, let data = data {
                result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            } else { result = nil }
            DispatchQueue.main.async { completion(result) }
        }.resume()
    }
    func refreshStatus() {
        let now = Date()
        if !activityBusy && now.timeIntervalSince(lastActivityPoll) >= 15 {
            activityBusy = true; lastActivityPoll = now
            statusRequest("/api/threads?limit=100") { [weak self] value in
                guard let self = self else { return }
                self.activeCount = (value?["sessions"] as? [[String: Any]])?.filter {
                    guard let stamp = $0["updatedAt"] as? Double else { return false }
                    return stamp >= Date().timeIntervalSince1970 - 1800
                }.count
                self.activityBusy = false; self.renderStatus()
            }
        }
        if !quotaBusy && now.timeIntervalSince(lastQuotaPoll) >= 300 {
            quotaBusy = true; lastQuotaPoll = now
            statusRequest("/api/account") { [weak self] value in
                guard let self = self else { return }
                self.quotaWindows = value?["windows"] as? [[String: Any]] ?? []
                self.quotaBusy = false; self.renderStatus()
            }
        }
        renderStatus()
    }
    func renderStatus() {
        guard item != nil else { return }
        let now = Date().timeIntervalSince1970
        let valid = quotaWindows.filter {
            guard let remaining = $0["remainingPercent"] as? Double, remaining.isFinite, (0...100).contains(remaining) else { return false }
            if let reset = $0["resetsAt"] as? Double, reset <= now { return false }
            return true
        }
        // Independent quota windows cannot be summed; show the tightest remaining window.
        let remaining = valid.compactMap { $0["remainingPercent"] as? Double }.min()
        let count = activeCount.map(String.init) ?? "—"
        let quota = remaining.map { String(format: "%.2f%%", $0) } ?? "—"
        item.button?.title = "▥ \(count) · \(quota)"
        let windows = valid.map { value -> String in
            let minutes = (value["windowDurationMins"] as? Int) ?? 0
            let label = minutes == 0 ? "窗口" : minutes % 1440 == 0 ? "\(minutes / 1440)天" : minutes % 60 == 0 ? "\(minutes / 60)小时" : "\(minutes)分钟"
            return label + "剩余 " + String(format: "%.2f%%", value["remainingPercent"] as! Double)
        }.joined(separator: " · ")
        let description = "30分钟内活跃 \(count) 个会话\n" + (windows.isEmpty ? "额度暂不可用" : windows) + "\n显示最低剩余窗口 · 点击展开"
        item.button?.toolTip = description
        item.button?.setAccessibilityLabel("Codex 用量：活跃 \(count)，剩余 \(quota)，点击展开")
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let base = URLComponents(string: connection),
              message.frameInfo.securityOrigin.protocol == "http",
              message.frameInfo.securityOrigin.host == "127.0.0.1",
              message.frameInfo.securityOrigin.port == base.port,
              let body = message.body as? [String: String] else { return }
        if body["action"] == "setTitle", let title = body["title"], title.count <= 180 {
            panel.title = title
            titleLabel.stringValue = title
            titleLabel.toolTip = title
            return
        }
        if body["action"] == "openThread" {
            guard let identifier = body["thread"], UUID(uuidString: identifier) != nil,
                  let url = URL(string: "codex://threads/" + identifier) else { return }
            // Use Codex's registered deeplink rather than UI scripting or window matching.
            NSWorkspace.shared.open(url)
            return
        }
        if body["action"] == "follow" {
            pinnedThread = nil
        } else if body["action"] == "pin", let identifier = body["thread"],
                  identifier.range(of: "^[A-Za-z0-9_-]{1,128}$", options: .regularExpression) != nil {
            pinnedThread = identifier
        } else { return }
        let value: [String: String] = pinnedThread.map { ["pinnedThread": $0] } ?? [:]
        if let data = try? JSONSerialization.data(withJSONObject: value) {
            try? data.write(to: folder.appendingPathComponent("preferences.json"), options: .atomic)
        }
        tick()
    }
    @objc func statusClicked() {
        if NSApp.currentEvent?.type == .rightMouseUp, let button = item.button {
            statusMenu.popUp(positioning: nil, at: NSPoint(x: 0, y: button.bounds.minY), in: button)
        } else if panel.isVisible {
            hideWindow()
        } else {
            showWindow()
        }
    }
    func windowShouldZoom(_ window: NSWindow, toFrame newFrame: NSRect) -> Bool {
        hideWindow()
        return false
    }
    @objc func showWindow() {
        panel.orderFrontRegardless()
        web.evaluateJavaScript("window.refreshUsage?.()", completionHandler: nil)
    }
    @objc func hideWindow() { panel.orderOut(nil) }
    @objc func quitWindow() {
        try? Data().write(to: folder.appendingPathComponent("paused"), options: .atomic)
        NSApp.terminate(nil)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { hideWindow(); return false }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, let base = URLComponents(string: connection),
              url.scheme == "http", url.host == "127.0.0.1", url.port == base.port else { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow()
        return true
    }
    func applicationWillTerminate(_ notification: Notification) { timer?.invalidate() }
}
