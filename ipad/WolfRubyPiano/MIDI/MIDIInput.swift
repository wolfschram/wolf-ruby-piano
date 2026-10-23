import SwiftUI
import CoreMIDI
import CoreAudioKit
import Observation

/// Receives note and sustain events from every connected MIDI source (USB, Bluetooth, network).
@MainActor @Observable
final class MIDIInput {
    static let shared = MIDIInput()

    private(set) var deviceNames: [String] = []
    var isConnected: Bool { !deviceNames.isEmpty }

    @ObservationIgnored var onNoteOn: ((_ pitch: Int, _ velocity: Int) -> Void)?
    @ObservationIgnored var onNoteOff: ((_ pitch: Int) -> Void)?
    @ObservationIgnored var onSustain: ((_ down: Bool) -> Void)?

    @ObservationIgnored private var client = MIDIClientRef()
    @ObservationIgnored private var inputPort = MIDIPortRef()
    @ObservationIgnored private var connectedSources: Set<MIDIEndpointRef> = []
    @ObservationIgnored private var started = false

    private init() {}

    func start() {
        guard !started else { return }

        let clientStatus = MIDIClientCreateWithBlock("WolfRubyPiano" as CFString, &client) { notification in
            switch notification.pointee.messageID {
            case .msgSetupChanged, .msgObjectAdded, .msgObjectRemoved:
                DispatchQueue.main.async {
                    MainActor.assumeIsolated { MIDIInput.shared.refreshSources() }
                }
            default:
                break
            }
        }
        guard clientStatus == noErr else { return }

        let portStatus = MIDIInputPortCreateWithProtocol(
            client, "WolfRubyPiano Input" as CFString, ._1_0, &inputPort
        ) { eventList, _ in
            MIDIInput.handle(eventList)
        }
        guard portStatus == noErr else {
            MIDIClientDispose(client)
            client = 0
            return
        }

        started = true
        refreshSources()
    }

    /// Connects any new sources, drops vanished ones, and republishes display names.
    private func refreshSources() {
        guard started else { return }
        var current: Set<MIDIEndpointRef> = []
        var names: [String] = []

        for index in 0..<MIDIGetNumberOfSources() {
            let source = MIDIGetSource(index)
            guard source != 0 else { continue }
            current.insert(source)
            if !connectedSources.contains(source),
               MIDIPortConnectSource(inputPort, source, nil) == noErr {
                connectedSources.insert(source)
            }
            names.append(Self.displayName(of: source))
        }

        for gone in connectedSources.subtracting(current) {
            MIDIPortDisconnectSource(inputPort, gone)
        }
        connectedSources.formIntersection(current)

        if names != deviceNames { deviceNames = names }
    }

    private static func displayName(of endpoint: MIDIEndpointRef) -> String {
        var name: Unmanaged<CFString>?
        if MIDIObjectGetStringProperty(endpoint, kMIDIPropertyDisplayName, &name) == noErr,
           let value = name?.takeRetainedValue() {
            return value as String
        }
        return "MIDI Device"
    }

    // MARK: - CoreMIDI thread

    private enum Event: Sendable {
        case noteOn(Int, Int)
        case noteOff(Int)
        case sustain(Bool)
    }

    /// Runs on CoreMIDI's receive thread; parses UMP words and hops to main for delivery.
    nonisolated private static func handle(_ eventList: UnsafePointer<MIDIEventList>) {
        var events: [Event] = []

        for packet in eventList.unsafeSequence() {
            let count = Int(packet.pointee.wordCount)
            withUnsafeBytes(of: packet.pointee.words) { raw in
                let words = raw.bindMemory(to: UInt32.self)
                var i = 0
                while i < count {
                    let word = words[i]
                    let type = word >> 28
                    if type == 0x2 {
                        let status = (word >> 20) & 0xF
                        let data1 = Int((word >> 8) & 0x7F)
                        let data2 = Int(word & 0x7F)
                        switch status {
                        case 0x9 where data2 > 0: events.append(.noteOn(data1, data2))
                        case 0x8, 0x9: events.append(.noteOff(data1))
                        case 0xB where data1 == 64: events.append(.sustain(data2 >= 64))
                        default: break
                        }
                    }
                    i += wordSize(forMessageType: type)
                }
            }
        }

        guard !events.isEmpty else { return }
        DispatchQueue.main.async {
            MainActor.assumeIsolated {
                let input = MIDIInput.shared
                for event in events {
                    switch event {
                    case .noteOn(let pitch, let velocity): input.onNoteOn?(pitch, velocity)
                    case .noteOff(let pitch): input.onNoteOff?(pitch)
                    case .sustain(let down): input.onSustain?(down)
                    }
                }
            }
        }
    }

    nonisolated private static func wordSize(forMessageType type: UInt32) -> Int {
        switch type {
        case 0x0, 0x1, 0x2, 0x6, 0x7: return 1
        case 0x3, 0x4, 0x8, 0x9, 0xA: return 2
        case 0xB, 0xC: return 3
        default: return 4 // 0x5, 0xD, 0xE, 0xF
        }
    }
}

/// Apple's Bluetooth MIDI pairing screen (CABTMIDICentralViewController) wrapped for SwiftUI, with a Done button.
struct BluetoothMIDIPairingView: UIViewControllerRepresentable {
    var onDone: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onDone: onDone) }

    func makeUIViewController(context: Context) -> UINavigationController {
        let central = CABTMIDICentralViewController()
        central.title = "Bluetooth MIDI"
        let coordinator = context.coordinator
        central.navigationItem.rightBarButtonItem = UIBarButtonItem(
            systemItem: .done,
            primaryAction: UIAction { _ in coordinator.onDone() }
        )
        return UINavigationController(rootViewController: central)
    }

    func updateUIViewController(_ controller: UINavigationController, context: Context) {
        context.coordinator.onDone = onDone
    }

    final class Coordinator {
        var onDone: () -> Void
        init(onDone: @escaping () -> Void) { self.onDone = onDone }
    }
}
