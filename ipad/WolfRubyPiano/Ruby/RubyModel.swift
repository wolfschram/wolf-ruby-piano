import SwiftUI
import Observation

// MARK: - Fingers

/// Right-hand five-finger C position (C4–G4). One colour + animal per finger, used everywhere.
enum RubyFinger: Int, CaseIterable, Identifiable, Hashable {
    case thumb = 1, two, three, four, five

    var id: Int { rawValue }
    var number: Int { rawValue }

    var animal: String {
        switch self {
        case .thumb: "🐻"
        case .two: "🦆"
        case .three: "🐸"
        case .four: "🐳"
        case .five: "🐭"
        }
    }

    var animalName: String {
        switch self {
        case .thumb: "bear"
        case .two: "duck"
        case .three: "frog"
        case .four: "whale"
        case .five: "mouse"
        }
    }

    var color: Color {
        switch self {
        case .thumb: Color(hex: 0xF0997B)
        case .two: Color(hex: 0xFAC775)
        case .three: Color(hex: 0x97C459)
        case .four: Color(hex: 0x85B7EB)
        case .five: Color(hex: 0xAFA9EC)
        }
    }

    /// Dark ink that reads on the finger colour.
    var ink: Color { Color(hex: 0x2A1A33) }

    var pitch: Int { [60, 62, 64, 65, 67][rawValue - 1] }
    var noteName: String { ["C", "D", "E", "F", "G"][rawValue - 1] }

    /// Same note name in any octave → finger (C D E F G only).
    static func forPitchClass(_ pitch: Int) -> RubyFinger? {
        switch ((pitch % 12) + 12) % 12 {
        case 0: .thumb
        case 2: .two
        case 4: .three
        case 5: .four
        case 7: .five
        default: nil
        }
    }

    static func forPitch(_ pitch: Int) -> RubyFinger? {
        allCases.first { $0.pitch == pitch }
    }
}

// MARK: - Songs

struct RubyNote: Hashable {
    let finger: RubyFinger
    let start: Double    // seconds
    let length: Double   // seconds
}

struct RubySong: Identifiable, Hashable {
    let id: String
    let title: String
    let emoji: String
    let keyCount: Int          // 3 or 5
    let notes: [RubyNote]
    var fromLibrary = false

    var duration: Double { notes.map { $0.start + $0.length }.max() ?? 0 }

    /// Written as "E1 D1 C2" — note letter + length in beats.
    init(id: String, title: String, emoji: String, keyCount: Int, bpm: Double = 96, score: String) {
        let beat = 60 / bpm
        var t = 0.0
        var notes: [RubyNote] = []
        for token in score.split(separator: " ") {
            guard let letter = token.first else { continue }
            var rest = String(token.dropFirst())
            if rest.hasPrefix(".") { rest = "0" + rest }
            let beats = Double(rest) ?? 1
            let finger: RubyFinger? = switch letter {
            case "C": .thumb
            case "D": .two
            case "E": .three
            case "F": .four
            case "G": .five
            default: nil
            }
            if let finger { notes.append(RubyNote(finger: finger, start: t, length: beats * beat * 0.9)) }
            t += beats * beat
        }
        self.init(id: id, title: title, emoji: emoji, keyCount: keyCount, notes: notes)
    }

    init(id: String, title: String, emoji: String, keyCount: Int, notes: [RubyNote], fromLibrary: Bool = false) {
        self.id = id
        self.title = title
        self.emoji = emoji
        self.keyCount = keyCount
        self.notes = notes
        self.fromLibrary = fromLibrary
    }
}

enum RubyLevel: String, Identifiable, CaseIterable {
    case fingers, threeKeys, fiveKeys

    var id: String { rawValue }

    var title: String {
        switch self {
        case .fingers: "Meet your fingers"
        case .threeKeys: "Three-key songs"
        case .fiveKeys: "Five-key songs"
        }
    }

    var subtitle: String {
        switch self {
        case .fingers: "Find the animal finger"
        case .threeKeys: "Level 1 · C D E"
        case .fiveKeys: "Level 2 · C D E F G"
        }
    }

    var animals: String {
        switch self {
        case .fingers: "🖐️"
        case .threeKeys: "🐻🦆🐸"
        case .fiveKeys: "🐻🦆🐸🐳🐭"
        }
    }

    var keyCount: Int { self == .threeKeys ? 3 : 5 }

    var gradient: [Color] {
        switch self {
        case .fingers: [Color(hex: 0xF27BA6), Color(hex: 0xB86ADB)]
        case .threeKeys: [Color(hex: 0xF59A8C), Color(hex: 0xE0679E)]
        case .fiveKeys: [Color(hex: 0xA77BF0), Color(hex: 0x6E62D6)]
        }
    }
}

/// Built-in kid songs, all inside the five-finger C position, plus fitting songs from the library.
@MainActor @Observable
final class RubySongBook {
    static let shared = RubySongBook()

    private(set) var librarySongs: [RubySong] = []
    @ObservationIgnored private var libraryScanned = false

    private init() {}

    static let threeKey: [RubySong] = [
        RubySong(id: "hot-cross-buns", title: "Hot Cross Buns", emoji: "🥯", keyCount: 3,
                 score: "E1 D1 C2 E1 D1 C2 C.5 C.5 C.5 C.5 D.5 D.5 D.5 D.5 E1 D1 C2"),
        RubySong(id: "mary-3", title: "Mary's Little Lamb", emoji: "🐑", keyCount: 3,
                 score: "E1 D1 C1 D1 E1 E1 E2 D1 D1 D2 E1 E1 E2 E1 D1 C1 D1 E1 E1 E1 E1 D1 D1 E1 D1 C4"),
        RubySong(id: "merrily-3", title: "Merrily We Roll Along", emoji: "🚂", keyCount: 3,
                 score: "E1.5 D.5 C1 D1 E1 E1 E2 D1 D1 D2 E1 E1 E2 E1.5 D.5 C1 D1 E1 E1 E1 C1 D1 D1 E1 D1 C4"),
        RubySong(id: "up-down-stairs", title: "Up and Down the Stairs", emoji: "🪜", keyCount: 3,
                 score: "C1 D1 E2 E1 D1 C2 C1 D1 E2 E1 D1 C2 C1 C1 D1 D1 E1 E1 E2 E1 D1 C2"),
        RubySong(id: "frog-says-hello", title: "Frog Says Hello", emoji: "🐸", keyCount: 3,
                 score: "E2 E2 E4 D2 D2 D4 C1 D1 E1 D1 C4"),
    ]

    static let fiveKey: [RubySong] = [
        RubySong(id: "ode-to-joy", title: "Ode to Joy", emoji: "🎉", keyCount: 5,
                 score: "E1 E1 F1 G1 G1 F1 E1 D1 C1 C1 D1 E1 E1.5 D.5 D2 E1 E1 F1 G1 G1 F1 E1 D1 C1 C1 D1 E1 D1.5 C.5 C2"),
        RubySong(id: "mary-5", title: "Mary Had a Little Lamb", emoji: "🐑", keyCount: 5,
                 score: "E1 D1 C1 D1 E1 E1 E2 D1 D1 D2 E1 G1 G2 E1 D1 C1 D1 E1 E1 E1 E1 D1 D1 E1 D1 C4"),
        RubySong(id: "aunt-rhody", title: "Go Tell Aunt Rhody", emoji: "🪿", keyCount: 5,
                 score: "E2 E1 D1 C2 C2 D2 D1 F1 E1 D1 C2 G2 G1 F1 E2 E2 D1 C1 D1 E1 C4"),
        RubySong(id: "lightly-row", title: "Lightly Row", emoji: "🚣", keyCount: 5,
                 score: "G1 E1 E2 F1 D1 D2 C1 D1 E1 F1 G1 G1 G2 G1 E1 E2 F1 D1 D2 C1 E1 G1 G1 C4 "
                      + "D1 D1 D1 D1 D1 E1 F2 E1 E1 E1 E1 E1 F1 G2 G1 E1 E2 F1 D1 D2 C1 E1 G1 G1 C4"),
        RubySong(id: "jingle-bells-5", title: "Jingle Bells", emoji: "🔔", keyCount: 5,
                 score: "E1 E1 E2 E1 E1 E2 E1 G1 C1.5 D.5 E4 F1 F1 F1.5 F.5 F1 E1 E1 E.5 E.5 E1 D1 D1 E1 D2 G2 "
                      + "E1 E1 E2 E1 E1 E2 E1 G1 C1.5 D.5 E4 F1 F1 F1 F1 F1 E1 E1 E.5 E.5 G1 G1 F1 D1 C4"),
        RubySong(id: "saints", title: "When the Saints", emoji: "🎺", keyCount: 5, bpm: 120,
                 score: "C1 E1 F1 G4 C1 E1 F1 G4 C1 E1 F1 G2 E2 C2 E2 D4 E1 E1 D1 C3 C1 E1 G2 G1 F3 E1 F1 G2 E2 C2 D2 C4"),
    ]

    func songs(for level: RubyLevel) -> [RubySong] {
        switch level {
        case .fingers: []
        case .threeKeys: Self.threeKey + librarySongs.filter { $0.keyCount == 3 }
        case .fiveKeys: Self.fiveKey + librarySongs.filter { $0.keyCount == 5 }
        }
    }

    /// Adds Ruby's library songs whose right-hand melody fits C4–G4 (white keys only) after transposition.
    func scanLibraryIfNeeded() {
        guard !libraryScanned else { return }
        libraryScanned = true
        let builtInTitles = Set((Self.threeKey + Self.fiveKey).map { Self.normalize($0.title) })
        var found: [RubySong] = []
        for entry in SongLibrary.shared.entries(in: .ruby) {
            let key = Self.normalize(entry.title)
            if builtInTitles.contains(where: { key.contains($0) || $0.contains(key) }) { continue }
            guard let song = try? SongLibrary.shared.load(entry) else { continue }
            let melody = Self.melody(of: song)
            guard melody.count >= 6, melody.count <= 120 else { continue }
            let threeKeys = [60, 62, 64]
            let fiveKeys = [60, 62, 64, 65, 67]
            let keyCount: Int
            let shift: Int
            if let t = Self.transposition(melody.map(\.pitch), into: threeKeys) {
                keyCount = 3; shift = t
            } else if let t = Self.transposition(melody.map(\.pitch), into: fiveKeys) {
                keyCount = 5; shift = t
            } else {
                continue
            }
            let t0 = melody[0].start
            let notes = melody.compactMap { m -> RubyNote? in
                guard let f = RubyFinger.forPitch(m.pitch + shift) else { return nil }
                return RubyNote(finger: f, start: m.start - t0, length: m.length)
            }
            found.append(RubySong(id: "lib-" + entry.id, title: entry.title, emoji: "🎵",
                                  keyCount: keyCount, notes: notes, fromLibrary: true))
        }
        librarySongs = found
    }

    private static func normalize(_ s: String) -> String {
        s.lowercased().filter { $0.isLetter }
    }

    /// Highest note per onset of the right hand (or all notes if no right hand).
    private static func melody(of song: Song) -> [(pitch: Int, start: Double, length: Double)] {
        var notes = song.notes.filter { $0.hand == .right }
        if notes.isEmpty { notes = song.notes }
        notes.sort { $0.start < $1.start }
        var groups: [[NoteEvent]] = []
        for n in notes {
            if let first = groups.last?.first, n.start - first.start <= 0.04 {
                groups[groups.count - 1].append(n)
            } else {
                groups.append([n])
            }
        }
        var result: [(pitch: Int, start: Double, length: Double)] = []
        for (i, g) in groups.enumerated() {
            guard let top = g.max(by: { $0.pitch < $1.pitch }) else { continue }
            let next = i + 1 < groups.count ? groups[i + 1][0].start : top.end
            let length = max(0.12, min(top.duration, next - top.start))
            result.append((top.pitch, top.start, length))
        }
        return result
    }

    /// Semitone shift that puts every pitch on one of the allowed keys, or nil.
    private static func transposition(_ pitches: [Int], into allowed: [Int]) -> Int? {
        guard let low = pitches.min() else { return nil }
        let set = Set(allowed)
        for base in allowed {
            let t = base - low
            if pitches.allSatisfy({ set.contains($0 + t) }) { return t }
        }
        return nil
    }
}

// MARK: - Stars

enum RubyStars {
    private static let prefix = "ruby.stars."

    static func key(level: RubyLevel, itemID: String) -> String { prefix + level.rawValue + "." + itemID }

    static func best(level: RubyLevel, itemID: String) -> Int {
        UserDefaults.standard.integer(forKey: key(level: level, itemID: itemID))
    }

    static func record(_ stars: Int, level: RubyLevel, itemID: String) {
        let k = key(level: level, itemID: itemID)
        if stars > UserDefaults.standard.integer(forKey: k) {
            UserDefaults.standard.set(stars, forKey: k)
        }
    }

    static func total(for level: RubyLevel) -> Int {
        let p = prefix + level.rawValue + "."
        return UserDefaults.standard.dictionaryRepresentation()
            .filter { $0.key.hasPrefix(p) }
            .compactMap { $0.value as? Int }
            .reduce(0, +)
    }
}
