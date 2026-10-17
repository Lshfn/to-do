import AppKit
import WebKit

// The page is bundled locally; no server, network connection or account is needed.
final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var item: NSStatusItem!
    private var panel: NSPanel!
    private var webView: WKWebView!
    private var localMonitor: Any?
    private var globalMonitor: Any?
    private let keys = ["daily-tasks-v1", "daily-appearance-v1", "custom"]
    private lazy var dataDirectory: URL = {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Daily", isDirectory: true)
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        do { try FileManager.default.createDirectory(at: dataDirectory, withIntermediateDirectories: true) }
        catch { showError("Daily cannot create its data folder: \(error.localizedDescription)") }
        let configuration = WKWebViewConfiguration()
        let controller = configuration.userContentController
        var saved: [String: String] = [:]
        for key in keys {
            let url = dataDirectory.appendingPathComponent(key + ".json")
            if FileManager.default.fileExists(atPath: url.path) {
                do { saved[key] = try String(contentsOf: url, encoding: .utf8) }
                catch { showError("Could not read saved \(key). Your original file has been kept. \(error.localizedDescription)") }
            }
        }
        let json = (try? JSONSerialization.data(withJSONObject: saved)) ?? Data("{}".utf8)
        let source = "window.dailyNative = \(String(decoding: json, as: UTF8.self)); document.addEventListener('DOMContentLoaded', () => document.body.classList.add('native'));"
        controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        controller.add(self, name: "dailySave")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.uiDelegate = self
        webView.navigationDelegate = self
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 470, height: 650), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        panel.title = "Daily"
        panel.isReleasedWhenClosed = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.minSize = NSSize(width: 360, height: 420)
        panel.contentView = webView
        item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = item.button {
            button.image = NSImage(systemSymbolName: "checklist", accessibilityDescription: "Daily to-do list")
            button.toolTip = "Daily — click to open; right-click to quit"
            button.target = self
            button.action = #selector(toggle)
            button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        }
        let menu = NSMenu()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Daily", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let menuItem = NSMenuItem()
        menuItem.submenu = appMenu
        menu.addItem(menuItem)
        NSApp.mainMenu = menu
        guard let resources = Bundle.main.resourceURL else { return }
        webView.loadFileURL(resources.appendingPathComponent("index.html"), allowingReadAccessTo: resources)
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            // Keep the app open while a native file or color picker is in use.
            guard NSApp.modalWindow == nil, self?.panel.attachedSheet == nil else { return }
            self?.panel.orderOut(nil)
        }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53, self?.panel.attachedSheet == nil { self?.panel.orderOut(nil); return nil }
            return event
        }
        showPanel()
    }

    @objc private func toggle() {
        if NSApp.currentEvent?.type == .rightMouseUp {
            let menu = NSMenu()
            let openItem = menu.addItem(withTitle: "Open Daily", action: #selector(openPanel), keyEquivalent: "")
            openItem.target = self
            menu.addItem(withTitle: "Quit Daily", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
            item.menu = menu
            item.button?.performClick(nil)
            item.menu = nil
        } else if panel.isVisible { panel.orderOut(nil) }
        else { showPanel() }
    }

    @objc private func openPanel() { showPanel() }
    private func showPanel() {
        if let button = item.button, let window = button.window {
            let rect = window.convertToScreen(button.convert(button.bounds, to: nil))
            let screen = window.screen?.visibleFrame ?? NSScreen.main!.visibleFrame
            let x = min(max(rect.midX - panel.frame.width / 2, screen.minX), screen.maxX - panel.frame.width)
            panel.setFrameOrigin(NSPoint(x: x, y: max(screen.minY, rect.minY - panel.frame.height - 8)))
        }
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let body = message.body as? [String: String],
              let key = body["key"], keys.contains(key), let value = body["value"] else { return }
        do {
            try Data(value.utf8).write(to: dataDirectory.appendingPathComponent(key + ".json"), options: .atomic)
        } catch { showError("Your latest change could not be saved. \(error.localizedDescription)") }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let picker = NSOpenPanel()
        picker.canChooseFiles = true
        picker.canChooseDirectories = false
        picker.allowsMultipleSelection = parameters.allowsMultipleSelection
        picker.beginSheetModal(for: panel) { response in completionHandler(response == .OK ? picker.urls : nil) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // Only the bundled page can run in the privileged native view.
        if let url = navigationAction.request.url, url.isFileURL,
           let resources = Bundle.main.resourceURL,
           url.standardizedFileURL.path.hasPrefix(resources.standardizedFileURL.path + "/") {
            decisionHandler(.allow)
        } else { decisionHandler(.cancel) }
    }

    private func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "Daily storage"
        alert.informativeText = message
        alert.runModal()
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let monitor = localMonitor { NSEvent.removeMonitor(monitor) }
        if let monitor = globalMonitor { NSEvent.removeMonitor(monitor) }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.setActivationPolicy(.accessory)
app.delegate = delegate
app.run()
