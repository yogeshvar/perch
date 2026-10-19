import AppKit
import ApplicationServices
import Foundation

private let edge: CGFloat = 28
private let idleTimeout: TimeInterval = 0.6
private var idleTimer: Timer?
private var shelfVisible = false
private var dragging = false
private var globalMonitor: Any?
private var localMonitor: Any?

private func emit(_ line: String) {
    guard let data = (line + "\n").data(using: .utf8) else { return }
    FileHandle.standardOutput.write(data)
}

private func num(_ value: CGFloat) -> String {
    String(format: "%.2f", locale: Locale(identifier: "en_US_POSIX"), Double(value))
}

private func installMonitors() {
    if globalMonitor != nil { return }
    guard AXIsProcessTrusted() else { return }
    let mask: NSEvent.EventTypeMask = [.scrollWheel]
    guard let installed = NSEvent.addGlobalMonitorForEvents(matching: mask, handler: { event in
        handle(event)
    }) else {
        return
    }
    globalMonitor = installed
    localMonitor = NSEvent.addLocalMonitorForEvents(matching: mask) { event in
        handle(event)
        return event
    }
    emit("trusted")
}

private func handle(_ event: NSEvent) {
    // Momentum keeps going after the fingers lift. The shelf should stop with the fingers.
    if event.momentumPhase != [] { return }

    let mouse = NSEvent.mouseLocation
    guard let screen = NSScreen.screens.first(where: { candidate in
        let frame = candidate.frame
        return mouse.x >= frame.minX && mouse.x < frame.maxX && mouse.y >= frame.minY && mouse.y <= frame.maxY
    }) else {
        finishDrag()
        return
    }

    let frame = screen.frame
    let nearTop = mouse.y >= frame.maxY - edge && mouse.y <= frame.maxY
        && mouse.x >= frame.minX && mouse.x < frame.maxX
    let raw = event.hasPreciseScrollingDeltas ? event.scrollingDeltaY : event.scrollingDeltaY * 22
    // Positive = fingers moving down, regardless of the natural-scrolling setting.
    let reveal = event.isDirectionInvertedFromDevice ? raw : -raw
    let phase = event.phase
    let fingerDown = !phase.isEmpty
    let ending = phase.contains(.ended) || phase.contains(.cancelled)

    if !dragging {
        if !nearTop || abs(reveal) < 0.4 { return }
        if (!shelfVisible && reveal < 0) || (shelfVisible && reveal > 0) {
            return
        }
        if fingerDown {
            dragging = true
        }
    } else if !nearTop && !fingerDown {
        return
    }

    if abs(reveal) >= 0.3 {
        let live = dragging ? "1" : "0"
        emit("drag \(num(frame.origin.x)) \(num(frame.origin.y)) \(num(frame.size.width)) \(num(frame.size.height)) \(num(reveal)) \(live)")
    }
    if ending {
        finishDrag()
    } else if dragging {
        // Backstop for a lost "ended" phase: don't stay stuck in a drag.
        idleTimer?.invalidate()
        idleTimer = Timer.scheduledTimer(withTimeInterval: idleTimeout, repeats: false) { _ in
            finishDrag()
        }
    }
}

private func finishDrag() {
    idleTimer?.invalidate()
    idleTimer = nil
    if !dragging { return }
    dragging = false
    emit("release")
}

private func handleCommand(_ line: String) {
    switch line {
    case "visible":
        shelfVisible = true
    case "hidden":
        shelfVisible = false
    case "prompt-trust":
        let key = kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String
        _ = AXIsProcessTrustedWithOptions([key: true] as CFDictionary)
        installMonitors()
    default:
        break
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
emit(AXIsProcessTrusted() ? "ready trusted" : "ready untrusted")
installMonitors()

DispatchQueue.global(qos: .userInitiated).async {
    while let line = readLine(strippingNewline: true) {
        DispatchQueue.main.async {
            handleCommand(line)
        }
    }
    // stdin closed: the app that started us is gone (quit or crashed). Do not outlive it.
    exit(0)
}

Timer.scheduledTimer(withTimeInterval: 1.5, repeats: true) { _ in
    installMonitors()
}

app.run()
