import Foundation

enum Hand: String, Codable, Hashable {
    case left, right
}

struct NoteEvent: Identifiable, Hashable {
    let id: Int
    let pitch: Int
    let start: Double      // seconds at 100% speed
    let duration: Double
    let velocity: Int
    var hand: Hand
    var finger: Int?       // 1 = thumb … 5 = pinky

    var end: Double { start + duration }
}

/// A group of notes that start together for one hand — what you press at once.
struct Chord: Hashable {
    let start: Double
    let noteIDs: [Int]
    let pitches: Set<Int>
    let hand: Hand
}

struct Phrase: Identifiable, Hashable {
    let id: Int
    let start: Double
    let end: Double
}

enum SongCategory: String, Codable {
    case wolf, ruby, exercise, imported

    var title: String {
        switch self {
        case .wolf: "Film & classical"
        case .ruby: "Ruby's songs"
        case .exercise: "Finger training"
        case .imported: "My imported songs"
        }
    }
}

struct Song: Identifiable {
    let id: String
    let title: String
    let artist: String
    let category: SongCategory
    let difficulty: Int
    var notes: [NoteEvent]       // sorted by start
    var tip: String? = nil       // shown for exercises

    var duration: Double { notes.map(\.end).max() ?? 0 }
    var lowestPitch: Int { notes.map(\.pitch).min() ?? 60 }
    var highestPitch: Int { notes.map(\.pitch).max() ?? 72 }

    /// Notes that start within 40 ms of each other count as one chord.
    func chords(for hands: Set<Hand>) -> [Chord] {
        var result: [Chord] = []
        for hand in hands {
            var group: [NoteEvent] = []
            func flush() {
                guard let first = group.first else { return }
                result.append(Chord(start: first.start, noteIDs: group.map(\.id),
                                    pitches: Set(group.map(\.pitch)), hand: hand))
                group.removeAll()
            }
            for note in notes where note.hand == hand {
                if let first = group.first, note.start - first.start > 0.04 { flush() }
                group.append(note)
            }
            flush()
        }
        // Merge both hands' chords that start together so "wait for me" waits for both.
        result.sort { $0.start < $1.start }
        var merged: [Chord] = []
        for chord in result {
            if let last = merged.last, chord.start - last.start <= 0.04 {
                merged[merged.count - 1] = Chord(start: last.start, noteIDs: last.noteIDs + chord.noteIDs,
                                                 pitches: last.pitches.union(chord.pitches), hand: last.hand)
            } else {
                merged.append(chord)
            }
        }
        return merged
    }

    /// Short practice chunks (roughly 4–8 seconds), broken at natural pauses.
    func phrases() -> [Phrase] {
        let onsets = Array(Set(notes.map { ($0.start * 1000).rounded() / 1000 })).sorted()
        guard let first = onsets.first else { return [] }
        var phrases: [Phrase] = []
        var phraseStart = first
        var count = 0
        for i in 1..<max(onsets.count, 1) where i < onsets.count {
            let t = onsets[i]
            let gap = t - onsets[i - 1]
            let length = t - phraseStart
            count += 1
            let naturalBreak = length >= 4 && gap >= 0.35
            let forcedBreak = length >= 8 || (gap >= 1.2 && count >= 3)
            if naturalBreak || forcedBreak {
                phrases.append(Phrase(id: phrases.count, start: phraseStart, end: t))
                phraseStart = t
                count = 0
            }
        }
        phrases.append(Phrase(id: phrases.count, start: phraseStart, end: duration))
        return phrases
    }
}

enum NoteName {
    static let names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]
    static func name(_ pitch: Int) -> String { names[((pitch % 12) + 12) % 12] }
    static func isBlack(_ pitch: Int) -> Bool { [1, 3, 6, 8, 10].contains(((pitch % 12) + 12) % 12) }
}
