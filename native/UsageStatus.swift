import AppKit

extension UsageApp {
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
}
