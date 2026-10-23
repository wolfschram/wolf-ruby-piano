import Foundation
import AVFoundation
import Observation
import os

// Salamander Grand Piano (Alexander Holm, CC-BY 3.0), the same set Tone.js serves.

@MainActor @Observable
final class PianoSound {
    static let shared = PianoSound()

    enum Status: Equatable { case idle, loading(Double), ready, failed(String) }

    private(set) var status: Status = .idle

    @ObservationIgnored private let bank = PianoVoiceBank()
    @ObservationIgnored private let engine = AVAudioEngine()
    @ObservationIgnored private var sourceNode: AVAudioSourceNode?
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    @ObservationIgnored private var sessionConfigured = false
    @ObservationIgnored private var loadTask: Task<Void, Never>?

    private init() {}

    // MARK: Public API

    func start() {
        if !sessionConfigured {
            configureSession()
            installObservers()
            sessionConfigured = true
        }
        startEngine()

        switch status {
        case .loading, .ready: return
        case .idle, .failed: loadSamples()
        }
    }

    func noteOn(_ pitch: Int, velocity: Int) {
        guard status == .ready, (21...108).contains(pitch) else { return }
        if !engine.isRunning { startEngine() }
        bank.noteOn(pitch: pitch, velocity: max(1, min(127, velocity)))
    }

    func noteOff(_ pitch: Int) {
        bank.noteOff(pitch: pitch)
    }

    func setSustain(_ down: Bool) {
        bank.setSustain(down)
    }

    func allNotesOff() {
        bank.allNotesOff()
    }

    // MARK: Audio session & engine

    private func configureSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setPreferredIOBufferDuration(0.005)
            try session.setActive(true)
        } catch {
            print("PianoSound: audio session error \(error)")
        }
    }

    private func buildGraph() {
        if let node = sourceNode {
            engine.disconnectNodeOutput(node)
            engine.detach(node)
        }
        var rate = engine.outputNode.outputFormat(forBus: 0).sampleRate
        if rate <= 0 { rate = AVAudioSession.sharedInstance().sampleRate }
        if rate <= 0 { rate = 48_000 }
        guard let format = AVAudioFormat(standardFormatWithSampleRate: rate, channels: 2) else { return }

        bank.setOutputRate(rate)
        let node = Self.makeSourceNode(bank: bank, format: format)
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
        sourceNode = node
    }

    private func startEngine() {
        if sourceNode == nil { buildGraph() }
        guard !engine.isRunning else { return }
        do {
            engine.prepare()
            try engine.start()
        } catch {
            print("PianoSound: engine start error \(error)")
        }
    }

    private func restartEngine(rebuild: Bool) {
        engine.stop()
        bank.allNotesOff(immediate: true)
        try? AVAudioSession.sharedInstance().setActive(true)
        if rebuild { buildGraph() }
        startEngine()
    }

    private func installObservers() {
        let center = NotificationCenter.default
        let session = AVAudioSession.sharedInstance()

        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification,
                                            object: session, queue: .main) { note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            let ended = raw.flatMap(AVAudioSession.InterruptionType.init(rawValue:)) == .ended
            Task { @MainActor in
                let sound = PianoSound.shared
                if ended { sound.restartEngine(rebuild: false) } else { sound.bank.allNotesOff(immediate: true) }
            }
        })
        observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange,
                                            object: engine, queue: .main) { _ in
            Task { @MainActor in PianoSound.shared.restartEngine(rebuild: true) }
        })
        observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                                            object: session, queue: .main) { _ in
            Task { @MainActor in
                let sound = PianoSound.shared
                sound.configureSession()
                sound.restartEngine(rebuild: true)
            }
        })
    }

    // Built outside the main actor so the render closure carries no actor isolation.
    nonisolated private static func makeSourceNode(bank: PianoVoiceBank, format: AVAudioFormat) -> AVAudioSourceNode {
        AVAudioSourceNode(format: format) { _, _, frameCount, bufferList -> OSStatus in
            let buffers = UnsafeMutableAudioBufferListPointer(bufferList)
            guard buffers.count >= 2,
                  let left = buffers[0].mData?.assumingMemoryBound(to: Float.self),
                  let right = buffers[1].mData?.assumingMemoryBound(to: Float.self) else {
                return noErr
            }
            bank.render(left: left, right: right, frames: Int(frameCount))
            return noErr
        }
    }

    // MARK: Sample loading

    private func loadSamples() {
        status = .loading(0)
        let bank = self.bank
        loadTask = Task {
            do {
                let directory = try Self.cacheDirectory()
                let total = SalamanderSet.names.count
                var done = 0
                try await withThrowingTaskGroup(of: Void.self) { group in
                    for (index, name) in SalamanderSet.names.enumerated() {
                        group.addTask {
                            let file = try await Self.fetch(name: name, into: directory)
                            let decoded = try Self.decode(file)
                            bank.install(decoded, at: index, root: SalamanderSet.roots[index])
                        }
                    }
                    for try await _ in group {
                        done += 1
                        self.status = .loading(Double(done) / Double(total))
                    }
                }
                self.status = .ready
            } catch {
                self.status = .failed(error.localizedDescription)
            }
        }
    }

    nonisolated private static func cacheDirectory() throws -> URL {
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        var dir = base.appendingPathComponent("Salamander", isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try? dir.setResourceValues(values)
        }
        return dir
    }

    nonisolated private static func fetch(name: String, into directory: URL) async throws -> URL {
        let destination = directory.appendingPathComponent("\(name).mp3")
        if FileManager.default.fileExists(atPath: destination.path) { return destination }

        let remote = URL(string: "https://tonejs.github.io/audio/salamander/\(name).mp3")!
        var lastError: Error = URLError(.unknown)
        for attempt in 0..<3 {
            do {
                let (temp, response) = try await URLSession.shared.download(from: remote)
                guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                    throw URLError(.badServerResponse)
                }
                try? FileManager.default.removeItem(at: destination)
                try FileManager.default.moveItem(at: temp, to: destination)
                return destination
            } catch {
                lastError = error
                try? await Task.sleep(nanoseconds: UInt64(attempt + 1) * 500_000_000)
            }
        }
        throw lastError
    }

    nonisolated private static func decode(_ url: URL) throws -> DecodedSample {
        do {
            return try decodeFile(url)
        } catch {
            // A corrupt cache entry should not poison every future launch.
            try? FileManager.default.removeItem(at: url)
            throw error
        }
    }

    nonisolated private static func decodeFile(_ url: URL) throws -> DecodedSample {
        let file = try AVAudioFile(forReading: url)
        let format = file.processingFormat
        let rate = format.sampleRate
        let maxFrames = AVAudioFrameCount(min(Double(file.length), rate * 7.0))
        guard maxFrames > 2, let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: maxFrames) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        try file.read(into: buffer, frameCount: maxFrames)
        guard let channels = buffer.floatChannelData else { throw CocoaError(.fileReadCorruptFile) }

        let frames = Int(buffer.frameLength)
        let channelCount = Int(format.channelCount)
        // One trailing guard sample keeps interpolation in bounds.
        let data = UnsafeMutablePointer<Float>.allocate(capacity: frames + 1)
        let scale = 1 / Float(channelCount)
        for i in 0..<frames {
            var sum: Float = 0
            for c in 0..<channelCount { sum += channels[c][i] }
            data[i] = sum * scale
        }
        data[frames] = 0

        let fadeFrames = min(frames, Int(rate * 0.12))
        for k in 0..<fadeFrames {
            let t = Float(k) / Float(fadeFrames)
            data[frames - fadeFrames + k] *= 0.5 * (1 + cos(t * .pi))
        }
        return DecodedSample(data: data, length: frames, sampleRate: rate)
    }
}

// MARK: - Sample set

private enum SalamanderSet {
    static let names: [String] = {
        var names = ["A0"]
        for octave in 1...7 {
            names += ["C\(octave)", "Ds\(octave)", "Fs\(octave)", "A\(octave)"]
        }
        return names + ["C8"]
    }()

    static let roots: [Int] = {
        var roots = [21]
        for octave in 1...7 {
            let base = 12 * (octave + 1)
            roots += [base, base + 3, base + 6, base + 9]
        }
        return roots + [108]
    }()
}

private struct DecodedSample: @unchecked Sendable {
    let data: UnsafeMutablePointer<Float>
    let length: Int
    let sampleRate: Double
}

// MARK: - Voice bank (real-time safe storage)

private struct Voice {
    var active = false
    var keyDown = false
    var releasing = false
    var pitch = 0
    var sample = 0
    var position: Double = 0
    var step: Double = 0
    var gain: Float = 0
    var panL: Float = 0
    var panR: Float = 0
    var env: Float = 1
    var releaseCoef: Float = 1
    var toneCoef: Float = 1
    var toneState: Float = 0
    var age: UInt64 = 0
}

/// Owns all audio-thread memory. Every mutable field is guarded by `lock`;
/// the render path touches only raw pointers and value types.
private final class PianoVoiceBank: @unchecked Sendable {
    static let voiceCount = 48
    static let slotCount = 30
    static let lowest = 21, highest = 108

    private let lock: UnsafeMutablePointer<os_unfair_lock>
    private let voices: UnsafeMutablePointer<Voice>
    private let sampleData: UnsafeMutablePointer<UnsafeMutablePointer<Float>?>
    private let sampleLength: UnsafeMutablePointer<Int>
    private let sampleRate: UnsafeMutablePointer<Double>
    private let sampleRoot: UnsafeMutablePointer<Int>
    private let slotForPitch: UnsafeMutablePointer<Int>   // indexed by pitch - lowest

    private var outputRate: Double = 48_000
    private var sustain = false
    private var clock: UInt64 = 0

    init() {
        lock = .allocate(capacity: 1)
        lock.initialize(to: os_unfair_lock())
        voices = .allocate(capacity: Self.voiceCount)
        voices.initialize(repeating: Voice(), count: Self.voiceCount)
        sampleData = .allocate(capacity: Self.slotCount)
        sampleData.initialize(repeating: nil, count: Self.slotCount)
        sampleLength = .allocate(capacity: Self.slotCount)
        sampleLength.initialize(repeating: 0, count: Self.slotCount)
        sampleRate = .allocate(capacity: Self.slotCount)
        sampleRate.initialize(repeating: 44_100, count: Self.slotCount)
        sampleRoot = .allocate(capacity: Self.slotCount)
        sampleRoot.initialize(repeating: 0, count: Self.slotCount)

        let span = Self.highest - Self.lowest + 1
        slotForPitch = .allocate(capacity: span)
        let roots = SalamanderSet.roots
        for offset in 0..<span {
            let pitch = Self.lowest + offset
            // Prefer the root at or below on ties: shifting up sounds more natural than down.
            var best = 0
            for i in roots.indices where abs(roots[i] - pitch) < abs(roots[best] - pitch) { best = i }
            slotForPitch[offset] = best
        }
    }

    deinit {
        for i in 0..<Self.slotCount { sampleData[i]?.deallocate() }
        sampleData.deallocate()
        sampleLength.deallocate()
        sampleRate.deallocate()
        sampleRoot.deallocate()
        slotForPitch.deallocate()
        voices.deallocate()
        lock.deallocate()
    }

    @inline(__always) private func withLock<T>(_ body: () -> T) -> T {
        os_unfair_lock_lock(lock)
        defer { os_unfair_lock_unlock(lock) }
        return body()
    }

    func setOutputRate(_ rate: Double) {
        withLock { outputRate = rate }
    }

    func install(_ sample: DecodedSample, at slot: Int, root: Int) {
        let old: UnsafeMutablePointer<Float>? = withLock {
            for v in 0..<Self.voiceCount where voices[v].sample == slot { voices[v].active = false }
            let previous = sampleData[slot]
            sampleData[slot] = sample.data
            sampleLength[slot] = sample.length
            sampleRate[slot] = sample.sampleRate
            sampleRoot[slot] = root
            return previous
        }
        old?.deallocate()
    }

    // MARK: Note control

    func noteOn(pitch: Int, velocity: Int) {
        let slot = slotForPitch[pitch - Self.lowest]
        let v = Float(velocity) / 127
        // Perceptual curve; headroom so a ten-finger forte chord stays below the limiter knee.
        let gain = 0.06 + 0.5 * powf(v, 1.6)
        let pan = Float(pitch - 64) / 44 * 0.35            // bass left, treble right, as seen from the bench
        let angle = (pan + 1) * .pi / 4
        // Softer strikes are darker: one-pole low-pass, wide open at forte.
        let cutoff = 900 + 17_000 * powf(v, 2.2)

        withLock {
            guard sampleData[slot] != nil else { return }
            let rate = outputRate
            for i in 0..<Self.voiceCount where voices[i].active && voices[i].pitch == pitch && !voices[i].releasing {
                startRelease(i, seconds: 0.04)
            }

            let index = pickVoice()
            clock &+= 1
            var voice = Voice()
            voice.active = true
            voice.keyDown = true
            voice.pitch = pitch
            voice.sample = slot
            voice.step = sampleRate[slot] / rate * pow(2, Double(pitch - sampleRoot[slot]) / 12)
            voice.gain = gain
            voice.panL = cosf(angle)
            voice.panR = sinf(angle)
            voice.toneCoef = 1 - expf(-2 * .pi * cutoff / Float(rate))
            voice.age = clock
            voices[index] = voice
        }
    }

    func noteOff(pitch: Int) {
        withLock {
            for i in 0..<Self.voiceCount where voices[i].active && voices[i].pitch == pitch && voices[i].keyDown {
                voices[i].keyDown = false
                if !sustain { startRelease(i, seconds: releaseTime(for: pitch)) }
            }
        }
    }

    func setSustain(_ down: Bool) {
        withLock {
            sustain = down
            guard !down else { return }
            for i in 0..<Self.voiceCount where voices[i].active && !voices[i].keyDown && !voices[i].releasing {
                startRelease(i, seconds: releaseTime(for: voices[i].pitch))
            }
        }
    }

    func allNotesOff(immediate: Bool = false) {
        withLock {
            sustain = false
            for i in 0..<Self.voiceCount where voices[i].active {
                voices[i].keyDown = false
                if immediate { voices[i].active = false } else { startRelease(i, seconds: 0.12) }
            }
        }
    }

    // Caller holds the lock.
    private func startRelease(_ i: Int, seconds: Double) {
        // Time constant chosen so the tail is ~-40 dB after `seconds`.
        let tau = seconds / 4.6
        let coef = Float(exp(-1 / (tau * outputRate)))
        if voices[i].releasing {
            voices[i].releaseCoef = min(voices[i].releaseCoef, coef)
        } else {
            voices[i].releasing = true
            voices[i].releaseCoef = coef
        }
    }

    // Damper on a bass string takes a little longer to settle than in the treble.
    private func releaseTime(for pitch: Int) -> Double {
        let low = Double(Self.highest - pitch) / Double(Self.highest - Self.lowest)
        return 0.18 + 0.17 * low
    }

    // Caller holds the lock.
    private func pickVoice() -> Int {
        var quietest = -1
        var quietestLevel = Float.greatestFiniteMagnitude
        var oldest = 0
        for i in 0..<Self.voiceCount {
            let v = voices[i]
            if !v.active { return i }
            if v.releasing, v.env * v.gain < quietestLevel {
                quietestLevel = v.env * v.gain
                quietest = i
            }
            if v.age < voices[oldest].age { oldest = i }
        }
        return quietest >= 0 ? quietest : oldest
    }

    // MARK: Render (audio thread)

    func render(left: UnsafeMutablePointer<Float>, right: UnsafeMutablePointer<Float>, frames: Int) {
        left.update(repeating: 0, count: frames)
        right.update(repeating: 0, count: frames)

        os_unfair_lock_lock(lock)
        for i in 0..<Self.voiceCount where voices[i].active {
            var v = voices[i]
            guard let data = sampleData[v.sample] else { voices[i].active = false; continue }
            let length = sampleLength[v.sample]
            let l = v.gain * v.panL
            let r = v.gain * v.panR

            for f in 0..<frames {
                let index = Int(v.position)
                if index >= length - 1 { v.active = false; break }
                let frac = Float(v.position - Double(index))
                let a = data[index]
                let s = a + (data[index + 1] - a) * frac
                v.toneState += v.toneCoef * (s - v.toneState)
                let out = v.toneState * v.env
                left[f] += out * l
                right[f] += out * r

                v.position += v.step
                if v.releasing {
                    v.env *= v.releaseCoef
                    if v.env < 0.0001 { v.active = false; break }
                }
            }
            voices[i] = v
        }
        os_unfair_lock_unlock(lock)

        // Transparent below ~0.5, smooth saturation above.
        for f in 0..<frames {
            left[f] = Self.softClip(left[f])
            right[f] = Self.softClip(right[f])
        }
    }

    @inline(__always) private static func softClip(_ x: Float) -> Float {
        let knee: Float = 0.5
        let m = abs(x)
        guard m > knee else { return x }
        let shaped = knee + (1 - knee) * tanhf((m - knee) / (1 - knee))
        return x < 0 ? -shaped : shaped
    }
}
