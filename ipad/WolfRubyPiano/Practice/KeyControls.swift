import SwiftUI
import Observation

/// Things a piano key can do instead of playing a note, so practice never needs the screen.
enum PianoAction: String, CaseIterable, Identifiable, Codable {
    case playPause, restart, stepBack, playFromHere, buildBackward, previousPhrase, nextPhrase

    var id: String { rawValue }

    var title: String {
        switch self {
        case .playPause: "Play / pause"
        case .restart: "Restart phrase"
        case .stepBack: "Step back one note"
        case .playFromHere: "Play from here"
        case .buildBackward: "Build backward on / off"
        case .previousPhrase: "Previous phrase"
        case .nextPhrase: "Next phrase"
        }
    }

    var symbol: String {
        switch self {
        case .playPause: "playpause.fill"
        case .restart: "arrow.counterclockwise"
        case .stepBack: "backward.end.fill"
        case .playFromHere: "play.fill"
        case .buildBackward: "arrow.uturn.backward"
        case .previousPhrase: "chevron.left.2"
        case .nextPhrase: "chevron.right.2"
        }
    }
}

@MainActor @Observable
final class KeyControls {
    static let shared = KeyControls()

    /// The top three keys of an 88-key piano: C8, B7, A7.
    static let defaults: [PianoAction: Int] = [.playPause: 108, .restart: 107, .stepBack: 105]

    private(set) var mapping: [PianoAction: Int]
    var enabled: Bool { didSet { UserDefaults.standard.set(enabled, forKey: "keyControls.enabled") } }

    private init() {
        let stored = UserDefaults.standard.dictionary(forKey: "keyControls.mapping") as? [String: Int]
        mapping = stored.map { raw in
            Dictionary(uniqueKeysWithValues: raw.compactMap { k, v in PianoAction(rawValue: k).map { ($0, v) } })
        } ?? Self.defaults
        enabled = UserDefaults.standard.object(forKey: "keyControls.enabled") as? Bool ?? true
    }

    func action(for pitch: Int) -> PianoAction? {
        guard enabled else { return nil }
        return mapping.first { $0.value == pitch }?.key
    }

    func assign(_ action: PianoAction, to pitch: Int) {
        for (other, key) in mapping where key == pitch { mapping[other] = nil }
        mapping[action] = pitch
        save()
    }

    func clear(_ action: PianoAction) {
        mapping[action] = nil
        save()
    }

    func resetToDefaults() {
        mapping = Self.defaults
        save()
    }

    private func save() {
        UserDefaults.standard.set(Dictionary(uniqueKeysWithValues: mapping.map { ($0.key.rawValue, $0.value) }),
                                  forKey: "keyControls.mapping")
    }

    /// "C8 · top key", "A7 · 3rd white key from the top".
    static func describe(_ pitch: Int) -> String {
        let name = NoteName.name(pitch) + "\(pitch / 12 - 1)"
        func ordinal(_ n: Int) -> String {
            switch n { case 1: "top"; case 2: "2nd"; case 3: "3rd"; default: "\(n)th" }
        }
        if pitch >= 96 {
            let whitesAbove = (pitch...108).filter { !NoteName.isBlack($0) }.count
            let kind = NoteName.isBlack(pitch) ? "black key near the top" : "\(ordinal(whitesAbove)) white key from the top"
            return pitch == 108 ? "\(name) · top key" : "\(name) · \(kind)"
        }
        if pitch <= 33 {
            let whitesBelow = (21...pitch).filter { !NoteName.isBlack($0) }.count
            let kind = NoteName.isBlack(pitch) ? "black key near the bottom"
                : (whitesBelow == 1 ? "bottom key" : "\(ordinal(whitesBelow)) white key from the bottom")
            return "\(name) · \(kind)"
        }
        return name
    }
}

/// Settings sheet: tap "Set key", press a piano key, done.
struct PianoKeySettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var listeningFor: PianoAction?
    @State private var savedNoteOn: ((Int, Int) -> Void)?
    private let controls = KeyControls.shared
    private let midi = MIDIInput.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Piano key controls").font(Brand.font(24, .bold)).foregroundStyle(Brand.ink)
                    Text("Control practice from the piano. Assigned keys don't play notes in songs.")
                        .font(Brand.font(14)).foregroundStyle(Brand.inkDim)
                }
                Spacer()
                Button("Done") { dismiss() }.buttonStyle(PrimaryButtonStyle())
            }
            .padding(24)

            Toggle(isOn: Bindable(controls).enabled) {
                Text("Use piano keys as controls").font(Brand.font(16, .semibold)).foregroundStyle(Brand.ink)
            }
            .tint(Brand.gold)
            .padding(.horizontal, 24)
            .padding(.bottom, 12)

            if !midi.isConnected {
                Label("Connect your piano to set keys.", systemImage: "pianokeys")
                    .font(Brand.font(14, .medium))
                    .foregroundStyle(Brand.warn)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 12)
            }

            ScrollView {
                VStack(spacing: 8) {
                    ForEach(PianoAction.allCases) { action in row(action) }
                }
                .padding(.horizontal, 24)
            }

            HStack {
                Button { controls.resetToDefaults() } label: { Label("Reset to top three keys", systemImage: "arrow.uturn.backward") }
                    .buttonStyle(CompactButtonStyle())
                Spacer()
            }
            .padding(24)
        }
        .background(Brand.surface)
        .opacity(controls.enabled ? 1 : 0.85)
        .onDisappear { stopListening() }
    }

    private func row(_ action: PianoAction) -> some View {
        let listening = listeningFor == action
        let key = controls.mapping[action]
        return HStack(spacing: 14) {
            Image(systemName: action.symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Brand.gold)
                .frame(width: 40, height: 40)
                .background(Brand.surface3, in: RoundedRectangle(cornerRadius: Brand.rControl))
            VStack(alignment: .leading, spacing: 2) {
                Text(action.title).font(Brand.font(16, .semibold)).foregroundStyle(Brand.ink)
                Text(listening ? "Press a key on your piano…" : key.map(KeyControls.describe) ?? "No key")
                    .font(Brand.font(13, listening ? .semibold : .regular))
                    .foregroundStyle(listening ? Brand.gold : Brand.inkDim)
            }
            Spacer()
            if key != nil, !listening {
                Button("Clear") { controls.clear(action) }.buttonStyle(CompactButtonStyle())
            }
            Button(listening ? "Cancel" : "Set key") {
                listening ? stopListening() : startListening(for: action)
            }
            .buttonStyle(CompactButtonStyle())
        }
        .padding(12)
        .background(listening ? Brand.gold.opacity(0.10) : Brand.surface2, in: RoundedRectangle(cornerRadius: Brand.rCard))
        .overlay(RoundedRectangle(cornerRadius: Brand.rCard).stroke(listening ? Brand.gold : Brand.line, lineWidth: 1))
        .animation(.easeOut(duration: 0.18), value: listening)
    }

    private func startListening(for action: PianoAction) {
        if listeningFor == nil { savedNoteOn = midi.onNoteOn }
        listeningFor = action
        midi.onNoteOn = { pitch, _ in
            controls.assign(action, to: pitch)
            stopListening()
        }
    }

    private func stopListening() {
        guard listeningFor != nil else { return }
        listeningFor = nil
        midi.onNoteOn = savedNoteOn
        savedNoteOn = nil
    }
}
