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
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let base = URLComponents(string: connection),
              message.frameInfo.securityOrigin.protocol == "http",
              message.frameInfo.securityOrigin.host == "127.0.0.1",
              message.frameInfo.securityOrigin.port == base.port,
              let body = message.body as? [String: String] else { return }
        if body["action"] == "fitHeight", let raw = body["height"], let height = Double(raw), height.isFinite, height > 0 {
            fitContentHeight(CGFloat(height))
            return
        }
        if body["action"] == "setTitle", let title = body["title"], title.count <= 180 {
            panel.title = title
            titleLabel.stringValue = title
            titleLabel.toolTip = title
            return
        }
        if body["action"] == "openPost", let address = body["url"],
           let url = URL(string: address), url.scheme == "https", url.host == "x.com",
           url.user == nil, url.password == nil, url.port == nil,
           url.query == nil, url.fragment == nil,
           url.path.range(of: "^/thsottiaux/status/[0-9]+$", options: .regularExpression) != nil {
            NSWorkspace.shared.open(url)
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
