import Foundation
import QuartzCore
import Observation

/// Records what Wolf plays on the piano so it can become a practice song.
@MainActor @Observable
final class Recorder {
    enum State: Equatable { case ready, countIn(Int), recording, finished }

    struct Take: Equatable {
        var pitch: Int
        var velocity: Int
        var start: Double        // seconds from the start of the recording
        var end: Double?
    }

    private(set) var state: State = .ready
    private(set) var takes: [Take] = []
    private(set) var held: Set<Int> = []
    private(set) var isPlayingBack = false
    var metronome = false
    var bpm = 80

    @ObservationIgnored private var origin: CFTimeInterval?
    @ObservationIgnored private var open: [Int: Int] = [:]          // pitch → index of the sounding take
    @ObservationIgnored private var waitingForPedal: Set<Int> = []  // take indices held by the pedal
    @ObservationIgnored private var pedalDown = false
    @ObservationIgnored private var clickTimer: Timer?
    @ObservationIgnored private var playbackTask: Task<Void, Never>?

    private var beat: Double { 60 / Double(bpm) }

    var duration: Double {
        takes.map { $0.end ?? $0.start }.max() ?? 0
    }

    var elapsed: Double {
        guard let origin, state == .recording else { return duration }
        return max(0, CACurrentMediaTime() - origin)
    }

    // MARK: - Recording

    func start() {
        stopPlayback()
        takes = []
        open = [:]
        waitingForPedal = []
        if metronome {
            // Four clicks to count in; the recording's time zero is the downbeat after them.
            let now = CACurrentMediaTime()
            origin = now + 4 * beat
            state = .countIn(4)
            var count = 0
            click(accent: true)
            clickTimer = Timer.scheduledTimer(withTimeInterval: beat, repeats: true) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    count += 1
                    if count < 4 {
                        self.state = .countIn(4 - count)
                        self.click(accent: false)
                    } else {
                        if self.state != .recording { self.state = .recording }
                        self.click(accent: (count - 4) % 4 == 0)
                    }
                }
            }
        } else {
            // Without a metronome the clock starts on the first note.
            origin = nil
            state = .recording
        }
    }

    func stop() {
        clickTimer?.invalidate()
        clickTimer = nil
        let now = time()
        for index in open.values { takes[index].end = now }
        for index in waitingForPedal { takes[index].end = now }
        open = [:]
        waitingForPedal = []
        held = []
        state = takes.isEmpty ? .ready : .finished
    }

    func discard() {
        stop()
        takes = []
        state = .ready
    }

    func noteOn(_ pitch: Int, velocity: Int) {
        held.insert(pitch)
        guard state == .recording || isCountingIn else { return }
        if origin == nil { origin = CACurrentMediaTime() }
        let now = time()
        if let index = open.removeValue(forKey: pitch) { takes[index].end = now }
        open[pitch] = takes.count
        takes.append(Take(pitch: pitch, velocity: velocity, start: now, end: nil))
    }

    func noteOff(_ pitch: Int) {
        held.remove(pitch)
        guard let index = open.removeValue(forKey: pitch) else { return }
        if pedalDown {
            waitingForPedal.insert(index)
        } else {
            takes[index].end = time()
        }
    }

    func sustain(_ down: Bool) {
        pedalDown = down
        guard !down else { return }
        let now = time()
        for index in waitingForPedal { takes[index].end = now }
        waitingForPedal = []
    }

    private var isCountingIn: Bool {
        if case .countIn = state { return true }
        return false
    }

    private func time() -> Double {
        guard let origin else { return 0 }
        return CACurrentMediaTime() - origin
    }

    private func click(accent: Bool) {
        PianoSound.shared.noteOn(accent ? 96 : 91, velocity: accent ? 60 : 40)
        PianoSound.shared.noteOff(accent ? 96 : 91)
    }

    // MARK: - Listen back

    func playBack() {
        stopPlayback()
        let notes = takes.sorted { $0.start < $1.start }
        let first = notes.first?.start ?? 0
        isPlayingBack = true
        playbackTask = Task { @MainActor [weak self] in
            var events: [(time: Double, on: Bool, pitch: Int, velocity: Int)] = []
            for n in notes {
                events.append((n.start - first, true, n.pitch, n.velocity))
                events.append(((n.end ?? n.start + 0.3) - first, false, n.pitch, 0))
            }
            events.sort { $0.time == $1.time ? !$0.on && $1.on : $0.time < $1.time }
            let begin = CACurrentMediaTime()
            for event in events {
                let wait = event.time - (CACurrentMediaTime() - begin)
                if wait > 0 { try? await Task.sleep(for: .seconds(wait)) }
                guard !Task.isCancelled else { break }
                if event.on {
                    PianoSound.shared.noteOn(event.pitch, velocity: event.velocity)
                } else {
                    PianoSound.shared.noteOff(event.pitch)
                }
            }
            PianoSound.shared.allNotesOff()
            self?.isPlayingBack = false
        }
    }

    func stopPlayback() {
        playbackTask?.cancel()
        playbackTask = nil
        if isPlayingBack { PianoSound.shared.allNotesOff() }
        isPlayingBack = false
    }

    // MARK: - Save

    /// A Standard MIDI file: right hand above middle C, left hand below, so the app's hand split is clear.
    func midiData() -> Data {
        let ticksPerBeat = 480
        let notes = takes.compactMap { take -> Take? in
            guard let end = take.end, end > take.start else { return nil }
            return take
        }
        // With the metronome the bars line up with what was played; a pickup before the downbeat
        // moves everything one bar later so nothing is lost.
        let shift = metronome && (notes.map(\.start).min() ?? 0) < 0 ? 4 * beat : 0
        let offset = metronome ? shift : -(notes.map(\.start).min() ?? 0)
        func tick(_ seconds: Double) -> Int { max(0, Int(((seconds + offset) / beat * Double(ticksPerBeat)).rounded())) }

        func track(name: String, _ part: [Take], meta: Bool) -> Data {
            var events: [(tick: Int, on: Bool, pitch: Int, velocity: Int)] = []
            for n in part {
                let s = tick(n.start)
                events.append((s, true, n.pitch, max(1, min(127, n.velocity))))
                events.append((max(s + 1, tick(n.end!)), false, n.pitch, 0))
            }
            events.sort { $0.tick == $1.tick ? !$0.on && $1.on : $0.tick < $1.tick }
            var body = Data()
            body += varLen(0) + [0xFF, 0x03, UInt8(name.utf8.count)] + Array(name.utf8)
            if meta {
                let micros = Int(60_000_000 / Double(bpm))
                body += varLen(0) + [0xFF, 0x51, 0x03, UInt8(micros >> 16 & 0xFF), UInt8(micros >> 8 & 0xFF), UInt8(micros & 0xFF)]
                body += varLen(0) + [0xFF, 0x58, 0x04, 4, 2, 24, 8]
            }
            body += varLen(0) + [0xC0, 0x00]
            var last = 0
            for e in events {
                body += varLen(e.tick - last) + [e.on ? 0x90 : 0x80, UInt8(e.pitch), UInt8(e.velocity)]
                last = e.tick
            }
            body += varLen(0) + [0xFF, 0x2F, 0x00]
            return Data("MTrk".utf8) + be32(body.count) + body
        }

        let right = notes.filter { $0.pitch >= 60 }
        let left = notes.filter { $0.pitch < 60 }
        var file = Data("MThd".utf8) + be32(6) + be16(1) + be16(2) + be16(ticksPerBeat)
        file += track(name: "Right hand", right, meta: true)
        file += track(name: "Left hand", left, meta: false)
        return file
    }

    private func varLen(_ value: Int) -> Data {
        var v = value
        var bytes = [UInt8(v & 0x7F)]
        v >>= 7
        while v > 0 {
            bytes.insert(UInt8(v & 0x7F) | 0x80, at: 0)
            v >>= 7
        }
        return Data(bytes)
    }
    private func be32(_ v: Int) -> Data { Data([UInt8(v >> 24 & 0xFF), UInt8(v >> 16 & 0xFF), UInt8(v >> 8 & 0xFF), UInt8(v & 0xFF)]) }
    private func be16(_ v: Int) -> Data { Data([UInt8(v >> 8 & 0xFF), UInt8(v & 0xFF)]) }
}

private func + (lhs: Data, rhs: [UInt8]) -> Data { lhs + Data(rhs) }
