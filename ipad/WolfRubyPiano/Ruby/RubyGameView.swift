import SwiftUI
import UIKit
import AVFoundation
import Observation

// MARK: - Game model

enum RubyGameMode: Hashable {
    case fingers
    case song(RubySong)
}

@MainActor @Observable
final class RubyGame {
    struct Target: Identifiable, Hashable {
        let id: Int
        let finger: RubyFinger
        let start: Double
        let length: Double
    }

    struct Burst: Identifiable {
        let id = UUID()
        let finger: RubyFinger
    }

    static let roundLimit: Double = 180   // 3 minutes max

    let mode: RubyGameMode
    let level: RubyLevel
    let itemID: String
    let title: String
    let emoji: String
    let fingers: [RubyFinger]
    let targets: [Target]

    private(set) var cursor = 0
    private(set) var notesPlayed = 0
    private(set) var gentleMisses = 0
    private(set) var pressed: Set<RubyFinger> = []
    private(set) var wiggle: [RubyFinger: Int] = [:]
    private(set) var bounce: [RubyFinger: Int] = [:]
    private(set) var bursts: [Burst] = []
    private(set) var finished = false
    private(set) var completed = false
    private(set) var stars = 0
    private(set) var listening = false
    private(set) var listenFinger: RubyFinger?

    @ObservationIgnored private var timerTask: Task<Void, Never>?
    @ObservationIgnored private var listenTask: Task<Void, Never>?
    @ObservationIgnored private let speech = AVSpeechSynthesizer()

    init(mode: RubyGameMode) {
        self.mode = mode
        switch mode {
        case .fingers:
            level = .fingers
            itemID = "fingers"
            title = "Meet your fingers"
            emoji = "🖐️"
            fingers = RubyFinger.allCases
            var picks: [RubyFinger] = []
            while picks.count < 10 {
                let f = RubyFinger.allCases.randomElement()!
                if f != picks.last { picks.append(f) }
            }
            targets = picks.enumerated().map { Target(id: $0.offset, finger: $0.element, start: Double($0.offset), length: 0.6) }
        case .song(let song):
            level = song.keyCount == 3 ? .threeKeys : .fiveKeys
            itemID = song.id
            title = song.title
            emoji = song.emoji
            fingers = Array(RubyFinger.allCases.prefix(song.keyCount))
            targets = song.notes.enumerated().map {
                Target(id: $0.offset, finger: $0.element.finger, start: $0.element.start, length: $0.element.length)
            }
        }
    }

    var current: Target? { cursor < targets.count ? targets[cursor] : nil }
    var isFingersMode: Bool { if case .fingers = mode { true } else { false } }

    var prompt: String? {
        guard isFingersMode, let f = current?.finger else { return nil }
        return "Which finger is the \(f.animalName)? Press it!"
    }

    func begin() {
        timerTask?.cancel()
        timerTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(Self.roundLimit))
            guard !Task.isCancelled else { return }
            self?.finish(completed: false)
        }
        speakPrompt()
    }

    func stop() {
        timerTask?.cancel()
        stopListening()
        speech.stopSpeaking(at: .immediate)
        for f in pressed { PianoSound.shared.noteOff(f.pitch) }
        pressed.removeAll()
    }

    // MARK: Input

    func press(_ finger: RubyFinger, fromScreen: Bool) {
        guard fingers.contains(finger) else { return }
        pressed.insert(finger)
        if fromScreen { PianoSound.shared.noteOn(finger.pitch, velocity: 90) }
        if listening { stopListening() }
        guard !finished, let target = current else { return }
        if finger == target.finger {
            notesPlayed += 1
            bounce[finger, default: 0] += 1
            let burst = Burst(finger: finger)
            bursts.append(burst)
            Task { [weak self] in
                try? await Task.sleep(for: .milliseconds(900))
                self?.bursts.removeAll { $0.id == burst.id }
            }
            cursor += 1
            if cursor >= targets.count {
                Task { [weak self] in
                    try? await Task.sleep(for: .milliseconds(650))
                    self?.finish(completed: true)
                }
            } else {
                speakPrompt()
            }
        } else {
            // No punishment: just a gentle wiggle of the right key.
            gentleMisses += 1
            wiggle[target.finger, default: 0] += 1
        }
    }

    func release(_ finger: RubyFinger, fromScreen: Bool) {
        pressed.remove(finger)
        if fromScreen { PianoSound.shared.noteOff(finger.pitch) }
    }

    func midiOn(_ pitch: Int) {
        guard let f = RubyFinger.forPitchClass(pitch), fingers.contains(f) else { return }
        press(f, fromScreen: false)
    }

    func midiOff(_ pitch: Int) {
        guard let f = RubyFinger.forPitchClass(pitch) else { return }
        release(f, fromScreen: false)
    }

    // MARK: Listen first

    func toggleListen() {
        if listening { stopListening(); return }
        guard case .song = mode, !finished else { return }
        listening = true
        let notes = targets
        let slow = 1.45
        listenTask = Task { [weak self] in
            let clock = ContinuousClock()
            let t0 = clock.now
            for note in notes {
                let at = t0 + .milliseconds(Int(note.start * slow * 1000))
                try? await clock.sleep(until: at)
                guard !Task.isCancelled, let self else { return }
                PianoSound.shared.noteOn(note.finger.pitch, velocity: 70)
                self.listenFinger = note.finger
                let off = at + .milliseconds(Int(note.length * slow * 1000))
                try? await clock.sleep(until: off)
                PianoSound.shared.noteOff(note.finger.pitch)
                if Task.isCancelled { return }
                self.listenFinger = nil
            }
            self?.listening = false
            self?.listenFinger = nil
        }
    }

    private func stopListening() {
        listenTask?.cancel()
        listenTask = nil
        if let f = listenFinger { PianoSound.shared.noteOff(f.pitch) }
        listening = false
        listenFinger = nil
    }

    // MARK: End of round

    private func finish(completed: Bool) {
        guard !finished else { return }
        timerTask?.cancel()
        stopListening()
        speech.stopSpeaking(at: .immediate)
        self.completed = completed
        let ratio = Double(gentleMisses) / Double(max(notesPlayed, 1))
        var s = ratio <= 0.25 ? 3 : (ratio <= 0.6 ? 2 : 1)
        if !completed { s = min(s, notesPlayed >= targets.count / 2 ? 2 : 1) }
        stars = s
        RubyStars.record(s, level: level, itemID: itemID)
        finished = true
    }

    private func speakPrompt() {
        guard let prompt else { return }
        speech.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: prompt)
        u.rate = 0.45
        u.pitchMultiplier = 1.15
        speech.speak(u)
    }
}

// MARK: - Game view

struct RubyGameView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var game: RubyGame
    @State private var previousOn: ((Int, Int) -> Void)?
    @State private var previousOff: ((Int) -> Void)?

    init(mode: RubyGameMode) {
        _game = State(initialValue: RubyGame(mode: mode))
    }

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let keysHeight = h * 0.38
            let keysTop = h - keysHeight - 16
            let landingY = keysTop - 18
            let laneWidth = (w - 32) / CGFloat(game.fingers.count)
            let tokenD = min(laneWidth * 0.62, 132)

            ZStack(alignment: .topLeading) {
                RubyBackdrop()

                // Lane guides
                ForEach(Array(game.fingers.enumerated()), id: \.element) { i, f in
                    RoundedRectangle(cornerRadius: 24)
                        .fill(f.color.opacity(game.current?.finger == f ? 0.16 : 0.06))
                        .frame(width: laneWidth - 18, height: max(0, landingY - 120))
                        .position(x: 16 + laneWidth * (CGFloat(i) + 0.5), y: 120 + (landingY - 120) / 2)
                }

                // Landing line
                Capsule()
                    .fill(Color.white.opacity(0.35))
                    .frame(width: w - 48, height: 4)
                    .position(x: w / 2, y: landingY)

                tokens(laneWidth: laneWidth, tokenD: tokenD, landingY: landingY, top: 100)

                // Bursts
                ForEach(game.bursts) { burst in
                    if let i = game.fingers.firstIndex(of: burst.finger) {
                        RubyBurst(color: burst.finger.color, reduceMotion: reduceMotion)
                            .frame(width: tokenD * 2.4, height: tokenD * 2.4)
                            .position(x: 16 + laneWidth * (CGFloat(i) + 0.5), y: landingY - tokenD / 2)
                            .allowsHitTesting(false)
                    }
                }

                // Giant keys
                RubyKeyRow(game: game, reduceMotion: reduceMotion)
                    .frame(width: w - 32, height: keysHeight)
                    .position(x: w / 2, y: keysTop + keysHeight / 2)

                topBar(width: w)

                if game.finished {
                    RubyCelebration(game: game, reduceMotion: reduceMotion,
                                    again: restart, done: { dismiss() })
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: game.finished)
        }
        .ignoresSafeArea()
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .onAppear(perform: attach)
        .onDisappear(perform: detach)
    }

    // MARK: Pieces

    @ViewBuilder
    private func tokens(laneWidth: CGFloat, tokenD: CGFloat, landingY: CGFloat, top: CGFloat) -> some View {
        let slots = slotOffsets(tokenD: tokenD)
        let base = game.cursor < slots.count ? slots[game.cursor] : 0
        let visible = game.targets.filter { t in
            t.id >= game.cursor && slots[t.id] - base < landingY - top
        }
        ForEach(visible) { t in
            if let lane = game.fingers.firstIndex(of: t.finger) {
                let y = landingY - tokenD / 2 - (slots[t.id] - base)
                RubyToken(finger: t.finger, size: tokenD, isNext: t.id == game.cursor, reduceMotion: reduceMotion)
                    .position(x: 16 + laneWidth * (CGFloat(lane) + 0.5), y: y)
                    .transition(reduceMotion ? .opacity : .scale(scale: 1.6).combined(with: .opacity))
                    .zIndex(Double(-t.id))
            }
        }
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.45, dampingFraction: 0.68),
                   value: game.cursor)
    }

    /// Vertical position of every token above the landing line: time-based, but never overlapping.
    private func slotOffsets(tokenD: CGFloat) -> [CGFloat] {
        var result: [CGFloat] = []
        var y: CGFloat = 0
        let pxPerSecond = tokenD * 1.7
        for (i, t) in game.targets.enumerated() {
            if i > 0 {
                let gap = CGFloat(t.start - game.targets[i - 1].start) * pxPerSecond
                y += max(gap, tokenD * 1.08)
            }
            result.append(y)
        }
        return result
    }

    private func topBar(width: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 16) {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 64, height: 64)
                    .background(Circle().fill(Color.white.opacity(0.16)))
            }
            .accessibilityLabel("Close")

            VStack(alignment: .leading, spacing: 4) {
                Text("\(game.emoji)  \(game.title)")
                    .font(Brand.font(26, .bold))
                    .foregroundStyle(.white)
                if let prompt = game.prompt, let f = game.current?.finger {
                    HStack(spacing: 10) {
                        Text(f.animal).font(.system(size: 34))
                        Text(prompt)
                            .font(Brand.font(22, .semibold))
                            .foregroundStyle(f.color)
                    }
                    .id(game.cursor)
                    .transition(.opacity)
                } else {
                    Text("\(game.notesPlayed) / \(game.targets.count)  ⭐️")
                        .font(Brand.font(18, .semibold))
                        .foregroundStyle(.white.opacity(0.75))
                }
            }
            .padding(.top, 6)

            Spacer(minLength: 12)

            if !game.isFingersMode {
                Button { game.toggleListen() } label: {
                    HStack(spacing: 8) {
                        Text(game.listening ? "⏹️" : "👂").font(.system(size: 26))
                        Text(game.listening ? "Stop" : "Listen first")
                            .font(Brand.font(20, .bold))
                    }
                    .foregroundStyle(Color(hex: 0x2A1A33))
                    .padding(.horizontal, 20)
                    .frame(minHeight: 60)
                    .background(Capsule().fill(Color(hex: 0xFFD9E8)))
                }
                .accessibilityLabel(game.listening ? "Stop listening" : "Listen first")
            }

            RubyHandGuide(fingers: game.fingers,
                          next: game.listenFinger ?? game.current?.finger,
                          reduceMotion: reduceMotion)
                .frame(width: 190, height: 112)
        }
        .padding(.horizontal, 24)
        .padding(.top, 20)
        .frame(width: width, alignment: .leading)
    }

    // MARK: Lifecycle

    private func attach() {
        PianoSound.shared.start()
        MIDIInput.shared.start()
        let midi = MIDIInput.shared
        previousOn = midi.onNoteOn
        previousOff = midi.onNoteOff
        let g = game
        midi.onNoteOn = { pitch, _ in g.midiOn(pitch) }
        midi.onNoteOff = { pitch in g.midiOff(pitch) }
        game.begin()
    }

    private func detach() {
        game.stop()
        MIDIInput.shared.onNoteOn = previousOn
        MIDIInput.shared.onNoteOff = previousOff
    }

    private func restart() {
        game.stop()
        let fresh = RubyGame(mode: game.mode)
        game = fresh
        MIDIInput.shared.onNoteOn = { pitch, _ in fresh.midiOn(pitch) }
        MIDIInput.shared.onNoteOff = { pitch in fresh.midiOff(pitch) }
        fresh.begin()
    }
}

// MARK: - Backdrop

private struct RubyBackdrop: View {
    var body: some View {
        LinearGradient(colors: [Color(hex: 0x2B1740), Color(hex: 0x170F26), Color(hex: 0x0E0A18)],
                       startPoint: .top, endPoint: .bottom)
            .overlay {
                Canvas { ctx, size in
                    var rng = SeededRandom(seed: 7)
                    for _ in 0..<60 {
                        let x = rng.next() * size.width
                        let y = rng.next() * size.height * 0.6
                        let r = 0.8 + rng.next() * 1.8
                        ctx.fill(Path(ellipseIn: CGRect(x: x, y: y, width: r * 2, height: r * 2)),
                                 with: .color(.white.opacity(0.08 + rng.next() * 0.25)))
                    }
                }
            }
            .ignoresSafeArea()
    }
}

private struct SeededRandom {
    var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> CGFloat {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return CGFloat((state >> 33) % 10_000) / 10_000
    }
}

// MARK: - Token

private struct RubyToken: View {
    let finger: RubyFinger
    let size: CGFloat
    let isNext: Bool
    let reduceMotion: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(finger.color)
                .shadow(color: finger.color.opacity(isNext ? 0.8 : 0.3), radius: isNext ? 22 : 8)
            Circle()
                .strokeBorder(.white.opacity(isNext ? 0.95 : 0.4), lineWidth: isNext ? 5 : 2)
            Text(finger.animal)
                .font(.system(size: size * 0.5))
                .offset(y: -size * 0.04)
            Text("\(finger.number)")
                .font(Brand.font(size * 0.2, .heavy))
                .foregroundStyle(finger.ink)
                .frame(width: size * 0.32, height: size * 0.32)
                .background(Circle().fill(.white))
                .offset(x: size * 0.36, y: size * 0.34)
        }
        .frame(width: size, height: size)
        .opacity(isNext ? 1 : 0.82)
        .phaseAnimator(isNext && !reduceMotion ? [false, true] : [false]) { view, up in
            view.offset(y: up ? -6 : 0).scaleEffect(up ? 1.04 : 1)
        } animation: { _ in .easeInOut(duration: 0.7) }
        .accessibilityLabel("\(finger.animalName), finger \(finger.number)")
    }
}

// MARK: - Giant keys

private struct RubyKeyRow: View {
    let game: RubyGame
    let reduceMotion: Bool

    var body: some View {
        HStack(spacing: 12) {
            ForEach(game.fingers) { f in
                RubyGiantKey(finger: f,
                             isPressed: game.pressed.contains(f),
                             isNext: (game.listenFinger ?? game.current?.finger) == f,
                             wiggle: game.wiggle[f, default: 0],
                             bounce: game.bounce[f, default: 0],
                             reduceMotion: reduceMotion)
            }
        }
        .overlay(
            RubyKeyTouchSurface(count: game.fingers.count,
                                onDown: { i in game.press(game.fingers[i], fromScreen: true) },
                                onUp: { i in game.release(game.fingers[i], fromScreen: true) })
        )
    }
}

private struct RubyGiantKey: View {
    let finger: RubyFinger
    let isPressed: Bool
    let isNext: Bool
    let wiggle: Int
    let bounce: Int
    let reduceMotion: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack(alignment: .bottom) {
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .fill(LinearGradient(colors: [finger.color.opacity(0.95), finger.color],
                                         startPoint: .top, endPoint: .bottom))
                    .brightness(isPressed ? -0.12 : 0)
                RoundedRectangle(cornerRadius: 30, style: .continuous)
                    .strokeBorder(.white.opacity(isNext ? 0.95 : 0.25), lineWidth: isNext ? 7 : 2)
                VStack(spacing: 6) {
                    Text(finger.animal)
                        .font(.system(size: min(w * 0.42, 110)))
                    Text("\(finger.number)")
                        .font(Brand.font(min(w * 0.36, 96), .heavy))
                        .foregroundStyle(finger.ink)
                }
                .padding(.bottom, 24)
                .frame(maxHeight: .infinity)
            }
            .shadow(color: finger.color.opacity(isNext ? 0.7 : 0.2), radius: isNext ? 24 : 6, y: 6)
            .scaleEffect(isPressed ? 0.97 : 1, anchor: .top)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: isPressed)
            .keyframeAnimator(initialValue: KeyMotion(), trigger: bounce) { view, m in
                view.scaleEffect(reduceMotion ? 1 : m.scale)
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    SpringKeyframe(1.06, duration: 0.14)
                    SpringKeyframe(1.0, duration: 0.35, spring: .bouncy)
                }
            }
            .keyframeAnimator(initialValue: KeyMotion(), trigger: wiggle) { view, m in
                view
                    .rotationEffect(.degrees(reduceMotion ? 0 : m.angle))
                    .overlay(
                        RoundedRectangle(cornerRadius: 30, style: .continuous)
                            .fill(.white.opacity(m.glow))
                    )
            } keyframes: { _ in
                KeyframeTrack(\.angle) {
                    LinearKeyframe(0, duration: 0.01)
                    CubicKeyframe(3, duration: 0.09)
                    CubicKeyframe(-3, duration: 0.12)
                    CubicKeyframe(2, duration: 0.12)
                    CubicKeyframe(-1.5, duration: 0.1)
                    CubicKeyframe(0, duration: 0.1)
                }
                KeyframeTrack(\.glow) {
                    LinearKeyframe(0, duration: 0.01)
                    CubicKeyframe(0.3, duration: 0.15)
                    CubicKeyframe(0, duration: 0.4)
                }
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(finger.animalName) key, finger \(finger.number)")
    }
}

private struct KeyMotion {
    var scale: CGFloat = 1
    var angle: Double = 0
    var glow: Double = 0
}

/// Multi-touch over the key row; each touch maps to a key by x position.
private struct RubyKeyTouchSurface: UIViewRepresentable {
    let count: Int
    let onDown: (Int) -> Void
    let onUp: (Int) -> Void

    func makeUIView(context: Context) -> TouchView {
        let view = TouchView()
        view.isMultipleTouchEnabled = true
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ view: TouchView, context: Context) {
        view.count = count
        view.onDown = onDown
        view.onUp = onUp
    }

    final class TouchView: UIView {
        var count = 3
        var onDown: ((Int) -> Void)?
        var onUp: ((Int) -> Void)?
        private var active: [ObjectIdentifier: Int] = [:]

        private func key(for touch: UITouch) -> Int? {
            let p = touch.location(in: self)
            guard bounds.contains(p), count > 0 else { return nil }
            return min(count - 1, max(0, Int(p.x / (bounds.width / CGFloat(count)))))
        }

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
            for touch in touches {
                guard let k = key(for: touch) else { continue }
                active[ObjectIdentifier(touch)] = k
                onDown?(k)
            }
        }

        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
            for touch in touches {
                let id = ObjectIdentifier(touch)
                guard let k = key(for: touch), k != active[id] else { continue }
                if let old = active[id] { onUp?(old) }
                active[id] = k
                onDown?(k)
            }
        }

        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
            for touch in touches {
                if let k = active.removeValue(forKey: ObjectIdentifier(touch)) { onUp?(k) }
            }
        }

        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
            touchesEnded(touches, with: event)
        }
    }
}

// MARK: - Hand guide

/// A little right hand seen from above: thumb on the left, coloured fingertips, next finger glows.
struct RubyHandGuide: View {
    let fingers: [RubyFinger]
    let next: RubyFinger?
    let reduceMotion: Bool

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let palmW = w * 0.62
            let palmH = h * 0.42
            let palmX = w * 0.58
            let palmY = h * 0.72
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(hex: 0xF6D5C3))
                    .frame(width: palmW, height: palmH)
                    .position(x: palmX, y: palmY)
                ForEach(RubyFinger.allCases) { f in
                    finger(f, w: w, h: h, palmX: palmX, palmW: palmW, palmY: palmY, palmH: palmH)
                }
            }
        }
        .accessibilityElement()
        .accessibilityLabel(next.map { "Next: finger \($0.number), the \($0.animalName)" } ?? "Hand")
    }

    @ViewBuilder
    private func finger(_ f: RubyFinger, w: CGFloat, h: CGFloat, palmX: CGFloat, palmW: CGFloat,
                        palmY: CGFloat, palmH: CGFloat) -> some View {
        let active = fingers.contains(f)
        let isNext = next == f
        let lengths: [CGFloat] = [0.30, 0.46, 0.52, 0.47, 0.36]
        let len = h * lengths[f.number - 1]
        let fw = w * 0.11
        let isThumb = f == .thumb
        let x: CGFloat = isThumb ? palmX - palmW / 2 - fw * 0.2
            : palmX - palmW / 2 + palmW * (0.14 + 0.24 * CGFloat(f.number - 2))
        let y: CGFloat = isThumb ? palmY - palmH * 0.05 : palmY - palmH / 2 - len / 2 + fw * 0.4
        let tip = isNext ? fw * 1.45 : fw * 1.05

        ZStack {
            Capsule()
                .fill(Color(hex: 0xF6D5C3))
                .frame(width: fw, height: len)
                .rotationEffect(.degrees(isThumb ? -50 : 0))
                .position(x: x, y: y)
            Circle()
                .fill(active ? f.color : Color.white.opacity(0.25))
                .overlay(Circle().strokeBorder(.white, lineWidth: isNext ? 3 : 0))
                .overlay(
                    Text(isNext ? f.animal : "\(f.number)")
                        .font(isNext ? .system(size: tip * 0.55) : Brand.font(tip * 0.55, .heavy))
                        .foregroundStyle(f.ink)
                )
                .frame(width: tip, height: tip)
                .shadow(color: isNext ? f.color : .clear, radius: 10)
                .position(x: isThumb ? x - len * 0.32 : x, y: isThumb ? y - len * 0.22 : y - len / 2 + fw * 0.2)
                .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.6), value: isNext)
        }
    }
}

// MARK: - Burst

private struct RubyBurst: View {
    let color: Color
    let reduceMotion: Bool
    @State private var go = false

    private let pieces: [(angle: Double, symbol: String)] = [
        (0, "⭐️"), (45, "✨"), (90, "⭐️"), (135, "✨"), (180, "⭐️"), (225, "✨"), (270, "⭐️"), (315, "✨"),
    ]

    var body: some View {
        GeometryReader { geo in
            let r = geo.size.width * 0.42
            ZStack {
                Circle()
                    .stroke(color, lineWidth: go ? 2 : 14)
                    .frame(width: go ? r * 2 : r * 0.6, height: go ? r * 2 : r * 0.6)
                    .opacity(go ? 0 : 0.9)
                if !reduceMotion {
                    ForEach(pieces.indices, id: \.self) { i in
                        let a = pieces[i].angle * .pi / 180
                        Text(pieces[i].symbol)
                            .font(.system(size: 30))
                            .offset(x: go ? cos(a) * r : 0, y: go ? sin(a) * r : 0)
                            .scaleEffect(go ? 0.6 : 1.2)
                            .opacity(go ? 0 : 1)
                    }
                } else {
                    Text("⭐️").font(.system(size: 50)).opacity(go ? 0 : 1)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8)) { go = true }
        }
    }
}

// MARK: - Celebration

private struct RubyCelebration: View {
    let game: RubyGame
    let reduceMotion: Bool
    let again: () -> Void
    let done: () -> Void
    @State private var shown = 0
    @State private var confetti = false

    var body: some View {
        ZStack {
            Color.black.opacity(0.55).ignoresSafeArea()

            if !reduceMotion {
                GeometryReader { geo in
                    ForEach(0..<28, id: \.self) { i in
                        let f = RubyFinger.allCases[i % 5]
                        Text(i % 3 == 0 ? f.animal : "🎉")
                            .font(.system(size: 34))
                            .position(x: geo.size.width * CGFloat((i * 37) % 100) / 100,
                                      y: confetti ? geo.size.height + 60 : -60 - CGFloat((i * 53) % 300))
                            .rotationEffect(.degrees(confetti ? Double(i * 40) : 0))
                    }
                }
                .allowsHitTesting(false)
            }

            VStack(spacing: 26) {
                HStack(spacing: 20) {
                    ForEach(0..<3, id: \.self) { i in
                        Text("⭐️")
                            .font(.system(size: 96))
                            .grayscale(i < game.stars ? 0 : 1)
                            .opacity(i < game.stars ? 1 : 0.25)
                            .scaleEffect(i < shown ? 1 : 0.2)
                            .rotationEffect(.degrees(i < shown || reduceMotion ? 0 : -40))
                    }
                }
                Text(game.isFingersMode ? "You found \(game.notesPlayed) fingers!" : "You played \(game.notesPlayed) notes!")
                    .font(Brand.font(44, .heavy))
                    .foregroundStyle(.white)
                Text(game.completed ? "Hooray, Ruby! 🎉" : "Great playing, Ruby! 🎉")
                    .font(Brand.font(26, .semibold))
                    .foregroundStyle(Color(hex: 0xFFD9E8))
                HStack(spacing: 24) {
                    Button(action: again) {
                        Label("Again", systemImage: "arrow.counterclockwise")
                            .font(Brand.font(28, .bold))
                            .foregroundStyle(Color(hex: 0x2A1A33))
                            .padding(.horizontal, 36)
                            .frame(minHeight: 84)
                            .background(Capsule().fill(Color(hex: 0xFAC775)))
                    }
                    Button(action: done) {
                        Label("All done", systemImage: "checkmark")
                            .font(Brand.font(28, .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 36)
                            .frame(minHeight: 84)
                            .background(Capsule().fill(Color(hex: 0xB86ADB)))
                    }
                }
                .padding(.top, 10)
            }
            .padding(48)
            .background(RoundedRectangle(cornerRadius: 40, style: .continuous).fill(Color(hex: 0x2B1740)))
            .overlay(RoundedRectangle(cornerRadius: 40, style: .continuous).strokeBorder(.white.opacity(0.18)))
        }
        .onAppear {
            if reduceMotion {
                shown = 3
            } else {
                withAnimation(.easeIn(duration: 2.6)) { confetti = true }
                Task { @MainActor in
                    for i in 0..<3 {
                        try? await Task.sleep(for: .milliseconds(300))
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.55)) { shown = i + 1 }
                    }
                }
            }
        }
    }
}
