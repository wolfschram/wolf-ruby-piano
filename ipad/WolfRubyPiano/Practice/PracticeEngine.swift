import Foundation
import QuartzCore
import Observation

@MainActor @Observable
final class PracticeEngine {
    enum Mode: String, CaseIterable { case listen, wait, flow }
    enum HandChoice: String, CaseIterable {
        case left, both, right
        var hands: Set<Hand> {
            switch self {
            case .left: [.left]
            case .right: [.right]
            case .both: [.left, .right]
            }
        }
    }
    enum KeyFlash { case correct, wrong }

    let song: Song
    let phrases: [Phrase]
    let keyRange: ClosedRange<Int>

    var mode: Mode = .wait { didSet { rebuildChords(); restartLoop() } }
    var handChoice: HandChoice = .both { didSet { rebuildChords(); restartLoop() } }
    var speed: Double = 0.7
    /// The iPad plays the hand you are not practicing.
    var accompany = true
    /// The iPad also sounds the keys you play on the piano (off: the piano's own speakers do it).
    var playMyKeys = false
    var showNoteNames = true
    /// Build a phrase from its last note backward; every attempt ends on familiar ground.
    var buildBackward = false { didSet { resetBackward(); restartLoop() } }

    private(set) var time: Double = -1.5
    private(set) var isPlaying = false
    private(set) var isWaiting = false
    private(set) var selectedPhrase: Int?
    private(set) var nextNoteIDs: Set<Int> = []
    private(set) var hitNoteIDs: Set<Int> = []
    private(set) var pressed: Set<Int> = []
    private(set) var flashes: [Int: KeyFlash] = [:]
    private(set) var mistakes = 0
    private(set) var passes: [Int: Int]
    private(set) var message: String?
    private(set) var sustainDown = false

    @ObservationIgnored private var chords: [Chord] = []
    @ObservationIgnored private var nextChord = 0
    @ObservationIgnored private var chordHits: Set<Int> = []
    @ObservationIgnored private var playIndex = 0
    @ObservationIgnored private var missIndex = 0
    @ObservationIgnored private var autoNotes: [(pitch: Int, end: Double)] = []
    @ObservationIgnored private var backwardChord = 0
    @ObservationIgnored private var displayLink: CADisplayLink?
    @ObservationIgnored private var lastTimestamp: CFTimeInterval = 0
    @ObservationIgnored private var messageTask: Task<Void, Never>?

    private let leadIn = 2.1
    @ObservationIgnored private var lastCount: Int?

    /// 3 · 2 · 1 before the loop starts (nil once the music is running).
    var countIn: Int? {
        guard isPlaying else { return nil }
        let remaining = loopRange.start - time
        guard remaining > 0.02, remaining <= leadIn else { return nil }
        return min(3, max(1, Int((remaining / leadIn * 3).rounded(.up))))
    }
    private let transportKeys: Set<Int> = [21, 22, 23, 107, 108]

    init(song: Song) {
        self.song = song
        self.phrases = song.phrases()
        self.passes = PracticeProgress.passes(songID: song.id)
        // Show only the keys the song uses (plus a small margin) so every key is as wide as possible.
        var lo = max(21, song.lowestPitch - 2)
        var hi = min(108, song.highestPitch + 2)
        while hi - lo < 23 {
            if lo > 21 { lo -= 1 }
            if hi - lo < 23, hi < 108 { hi += 1 }
        }
        self.keyRange = lo...hi
        if song.category == .exercise { speed = 0.8 }
        rebuildChords()
        // Park just before the first note so the opening keys are visible before Play.
        seek(-0.6)
    }

    // MARK: - Derived

    var practicedHands: Set<Hand> { mode == .listen ? [] : handChoice.hands }

    var loopRange: (start: Double, end: Double) {
        guard let p = selectedPhrase, phrases.indices.contains(p) else { return (0, song.duration) }
        var start = phrases[p].start
        if buildBackward, chords.indices.contains(backwardChord) { start = chords[backwardChord].start }
        return (start, phrases[p].end)
    }

    var currentPhrase: Int? {
        phrases.lastIndex { $0.start <= max(time, 0) }
    }

    func isMastered(_ phrase: Int) -> Bool { (passes[phrase] ?? 0) >= PracticeProgress.passesToMaster }

    /// Fingers needed next, per hand (for the hand guide).
    func nextFingers(for hand: Hand) -> [Int] {
        song.notes.filter { nextNoteIDs.contains($0.id) && $0.hand == hand }.compactMap(\.finger)
    }

    // MARK: - Transport

    func play() {
        guard !isPlaying else { return }
        if time >= loopRange.end - 0.01 { restartLoop() }
        // Starting at the top of the loop: back up for a 3 · 2 · 1 count-in.
        if time > loopRange.start - leadIn, time <= loopRange.start + 0.01 { seek(loopRange.start - leadIn) }
        isPlaying = true
        lastTimestamp = 0
        let link = CADisplayLink(target: DisplayLinkProxy { [weak self] link in self?.tick(link) },
                                 selector: #selector(DisplayLinkProxy.fire(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func pause() {
        isPlaying = false
        displayLink?.invalidate()
        displayLink = nil
        releaseAutoNotes(all: true)
    }

    func togglePlay() { isPlaying ? pause() : play() }

    func stop() {
        pause()
        PianoSound.shared.allNotesOff()
    }

    func restartLoop() {
        // While paused, park close so the first notes are in view; Play adds the count-in.
        seek(loopRange.start - (isPlaying ? leadIn : 0.6))
    }

    /// Back up one chord (Wait for me) or two seconds (other modes) and try again.
    func stepBack() {
        if mode == .wait, !chords.isEmpty {
            let floor = chords.firstIndex { $0.start >= loopRange.start - 0.001 } ?? 0
            let target = max(floor, nextChord - 1)
            seek(chords[target].start - 0.6)
        } else {
            seek(max(loopRange.start - leadIn, time - 2))
        }
    }

    func selectPhrase(_ index: Int?) {
        selectedPhrase = index
        resetBackward()
        restartLoop()
    }

    func seek(_ t: Double) {
        time = t
        nextChord = chords.firstIndex { $0.start >= t - 0.001 } ?? chords.count
        playIndex = song.notes.firstIndex { $0.start >= t - 0.001 } ?? song.notes.count
        missIndex = playIndex
        chordHits = []
        hitNoteIDs = hitNoteIDs.filter { id in song.notes[id].start < t }
        mistakes = 0
        isWaiting = false
        releaseAutoNotes(all: true)
        updateNext()
    }

    // MARK: - Input

    func noteOn(_ pitch: Int, velocity: Int, fromScreen: Bool) {
        if !fromScreen, transportKeys.contains(pitch) { transport(pitch); return }
        pressed.insert(pitch)
        if fromScreen || playMyKeys { PianoSound.shared.noteOn(pitch, velocity: velocity) }
        judge(pitch)
    }

    func noteOff(_ pitch: Int, fromScreen: Bool) {
        if !fromScreen, transportKeys.contains(pitch) { return }
        pressed.remove(pitch)
        if fromScreen || playMyKeys { PianoSound.shared.noteOff(pitch) }
    }

    func sustain(_ down: Bool) {
        sustainDown = down
        if playMyKeys { PianoSound.shared.setSustain(down) }
    }

    private func transport(_ pitch: Int) {
        switch pitch {
        case 21: togglePlay()                                    // A0
        case 22: buildBackward.toggle()                          // A♯0
        case 23: pause(); restartLoop()                          // B0
        case 108: stepBack()                                     // C8
        case 107: play()                                         // B7
        default: break
        }
    }

    private func judge(_ pitch: Int) {
        switch mode {
        case .listen:
            return
        case .wait:
            guard nextChord < chords.count else { return }
            let chord = chords[nextChord]
            guard chord.start - time <= 0.8 else { return }
            if chord.pitches.contains(pitch) {
                chordHits.insert(pitch)
                for id in chord.noteIDs where song.notes[id].pitch == pitch { hitNoteIDs.insert(id) }
                flash(pitch, .correct)
                if chordHits.isSuperset(of: chord.pitches) {
                    nextChord += 1
                    chordHits = []
                    isWaiting = false
                    updateNext()
                    if !isPlaying { play() }
                }
            } else {
                mistakes += 1
                flash(pitch, .wrong)
            }
        case .flow:
            let window = 0.25 * max(speed, 0.5)
            if let note = song.notes.first(where: {
                $0.pitch == pitch && practicedHands.contains($0.hand) && !hitNoteIDs.contains($0.id)
                    && abs($0.start - time) <= window
            }) {
                hitNoteIDs.insert(note.id)
                flash(pitch, .correct)
            } else {
                mistakes += 1
                flash(pitch, .wrong)
            }
        }
    }

    private func flash(_ pitch: Int, _ kind: KeyFlash) {
        flashes[pitch] = kind
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .milliseconds(260))
            if self?.flashes[pitch] == kind { self?.flashes[pitch] = nil }
        }
    }

    // MARK: - Clock

    private func tick(_ link: CADisplayLink) {
        let now = link.targetTimestamp
        let dt = lastTimestamp == 0 ? 0 : min(0.1, now - lastTimestamp)
        lastTimestamp = now
        var target = time + dt * speed

        if mode == .wait, nextChord < chords.count {
            let chord = chords[nextChord]
            if target >= chord.start {
                target = chord.start
                if !isWaiting { isWaiting = true }
            }
        }
        time = target
        if let count = countIn, count != lastCount {
            // Soft tick for the count-in.
            PianoSound.shared.noteOn(96, velocity: 45)
            PianoSound.shared.noteOff(96)
        }
        lastCount = countIn
        autoPlay()

        if mode == .flow { countMisses() }

        if time >= loopRange.end {
            finishPass()
        }
    }

    private func autoPlay() {
        while playIndex < song.notes.count, song.notes[playIndex].start <= time {
            let note = song.notes[playIndex]
            playIndex += 1
            let shouldPlay = mode == .listen || (accompany && !practicedHands.contains(note.hand))
            if shouldPlay {
                PianoSound.shared.noteOn(note.pitch, velocity: note.velocity)
                autoNotes.append((note.pitch, note.end))
            }
        }
        releaseAutoNotes(all: false)
    }

    private func releaseAutoNotes(all: Bool) {
        autoNotes.removeAll { note in
            if all || note.end <= time {
                PianoSound.shared.noteOff(note.pitch)
                return true
            }
            return false
        }
    }

    private func countMisses() {
        let window = 0.25 * max(speed, 0.5)
        while missIndex < song.notes.count, song.notes[missIndex].start < time - window {
            let note = song.notes[missIndex]
            if practicedHands.contains(note.hand), !hitNoteIDs.contains(note.id) { mistakes += 1 }
            missIndex += 1
        }
        nextNoteIDs = Set(song.notes[missIndex..<min(song.notes.count, missIndex + 12)]
            .filter { practicedHands.contains($0.hand) && $0.start - time < 0.6 && !hitNoteIDs.contains($0.id) }
            .map(\.id))
    }

    private func finishPass() {
        guard let phrase = selectedPhrase else {
            pause()
            show("End of song. Pick a phrase below to drill it.")
            return
        }
        let clean = mistakes == 0 && mode != .listen
        if clean, buildBackward, let first = firstChord(in: phrase), backwardChord > first {
            backwardChord = max(first, backwardChord - 1)
            show("Clean! One more note added.")
        } else if clean {
            PracticeProgress.recordCleanPass(songID: song.id, phrase: phrase)
            passes = PracticeProgress.passes(songID: song.id)
            let count = passes[phrase] ?? 0
            show(count >= PracticeProgress.passesToMaster
                 ? "Phrase \(phrase + 1) mastered"
                 : "Clean pass · \(count) of \(PracticeProgress.passesToMaster)")
        } else if mode != .listen {
            show("\(mistakes) slip\(mistakes == 1 ? "" : "s") · again")
        }
        restartLoop()
    }

    // MARK: - Helpers

    private func rebuildChords() {
        chords = song.chords(for: practicedHands)
        nextChord = chords.firstIndex { $0.start >= time - 0.001 } ?? chords.count
        resetBackward()
        updateNext()
    }

    private func firstChord(in phrase: Int) -> Int? {
        chords.firstIndex { $0.start >= phrases[phrase].start - 0.001 && $0.start < phrases[phrase].end }
    }

    private func resetBackward() {
        guard let p = selectedPhrase, phrases.indices.contains(p) else { backwardChord = 0; return }
        backwardChord = chords.lastIndex { $0.start < phrases[p].end && $0.start >= phrases[p].start - 0.001 }
            ?? firstChord(in: p) ?? 0
    }

    private func updateNext() {
        if mode == .wait, nextChord < chords.count {
            nextNoteIDs = Set(chords[nextChord].noteIDs)
        } else {
            nextNoteIDs = []
        }
    }

    private func show(_ text: String) {
        message = text
        messageTask?.cancel()
        messageTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(2.4))
            guard !Task.isCancelled else { return }
            self?.message = nil
        }
    }
}

private final class DisplayLinkProxy: NSObject {
    let handler: (CADisplayLink) -> Void
    init(_ handler: @escaping (CADisplayLink) -> Void) { self.handler = handler }
    @objc func fire(_ link: CADisplayLink) { handler(link) }
}
