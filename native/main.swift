import AppKit

let app = NSApplication.shared
let delegate = UsageApp(folder: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
app.delegate = delegate
app.run()
