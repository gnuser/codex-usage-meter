import AppKit

extension UsageApp {
    func fitContentHeight(_ contentHeight: CGFloat) {
        guard let screen = panel.screen ?? NSScreen.main else { return }
        let bounds = screen.visibleFrame
        var frame = panel.frame
        let chrome = frame.height - panel.contentRect(forFrameRect: frame).height
        let height = max(panel.minSize.height, min(480, bounds.height * 0.6, ceil(contentHeight + chrome)))
        guard abs(frame.height - height) >= 2 else { return }
        // Keep the bottom edge anchored; expanding must not move below the screen.
        frame.size.height = height
        frame.origin.y = max(bounds.minY, min(frame.minY, bounds.maxY - height))
        panel.setFrame(frame, display: true, animate: false)
    }
}
