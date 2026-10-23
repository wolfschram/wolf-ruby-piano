import Foundation

/// Suggests a finger (1 = thumb … 5 = pinky) for every note, per hand.
/// A simple cost model searched with dynamic programming: fingers like to sit
/// about a whole step apart, the thumb may pass under 2–4, the same finger
/// should not jump between different keys, and thumbs avoid black keys.
enum Fingering {
    static func apply(to notes: inout [NoteEvent]) {
        for hand in [Hand.left, .right] {
            let indices = notes.indices.filter { notes[$0].hand == hand && notes[$0].finger == nil }
            guard !indices.isEmpty else { continue }

            // Group into chords (notes starting within 40 ms).
            var events: [[Int]] = []
            for i in indices {
                if let last = events.last?.first, notes[i].start - notes[last].start <= 0.04 {
                    events[events.count - 1].append(i)
                } else {
                    events.append([i])
                }
            }

            // Mirror the left hand so one set of rules covers both hands.
            func key(_ i: Int) -> Int { hand == .right ? notes[i].pitch : -notes[i].pitch }

            var eventNotes: [[Int]] = []      // sorted by mirrored pitch, at most 5
            var options: [[[Int]]] = []       // candidate finger lists per event
            for event in events {
                let sorted = event.sorted { key($0) < key($1) }
                let usable = Array(sorted.prefix(5))
                eventNotes.append(usable)
                options.append(candidates(count: usable.count).filter {
                    chordCost(usable.map { key($0) }, $0, usable.map { notes[$0].pitch }) < 50
                })
                if options[options.count - 1].isEmpty { options[options.count - 1] = candidates(count: usable.count) }
            }

            // Viterbi over events.
            var cost: [[Double]] = []
            var back: [[Int]] = []
            for e in 0..<eventNotes.count {
                let keys = eventNotes[e].map { key($0) }
                let pitches = eventNotes[e].map { notes[$0].pitch }
                var row: [Double] = []
                var from: [Int] = []
                for option in options[e] {
                    let own = chordCost(keys, option, pitches)
                    if e == 0 {
                        row.append(own); from.append(0); continue
                    }
                    let prevKeys = eventNotes[e - 1].map { key($0) }
                    var best = Double.infinity
                    var bestIndex = 0
                    for (j, prevOption) in options[e - 1].enumerated() {
                        let c = cost[e - 1][j] + transition(prevKeys, prevOption, keys, option)
                        if c < best { best = c; bestIndex = j }
                    }
                    row.append(best + own); from.append(bestIndex)
                }
                cost.append(row); back.append(from)
            }

            guard var choice = cost.last?.indices.min(by: { cost.last![$0] < cost.last![$1] }) else { continue }
            for e in stride(from: eventNotes.count - 1, through: 0, by: -1) {
                for (n, noteIndex) in eventNotes[e].enumerated() {
                    notes[noteIndex].finger = options[e][choice][n]
                }
                choice = back[e][choice]
            }
        }
    }

    /// Increasing finger sequences of a given length (fingers rise with mirrored pitch).
    private static func candidates(count: Int) -> [[Int]] {
        func build(_ start: Int, _ remaining: Int) -> [[Int]] {
            if remaining == 0 { return [[]] }
            guard start <= 5 else { return [] }
            return (start...5).flatMap { f in build(f + 1, remaining - 1).map { [f] + $0 } }
        }
        return build(1, count)
    }

    /// Largest comfortable stretch (semitones) between two fingers.
    private static func maxSpan(_ a: Int, _ b: Int) -> Int {
        let lo = min(a, b), gap = abs(a - b)
        switch gap {
        case 0: return 0
        case 1: return lo == 1 ? 5 : 3
        case 2: return lo == 1 ? 7 : 5
        case 3: return lo == 1 ? 9 : 7
        default: return 12
        }
    }

    private static func blackPenalty(_ finger: Int, _ pitch: Int) -> Double {
        guard NoteName.isBlack(pitch) else { return 0 }
        return finger == 1 ? 2.5 : finger == 5 ? 1 : 0
    }

    private static func chordCost(_ keys: [Int], _ fingers: [Int], _ pitches: [Int]) -> Double {
        var c = 0.0
        for i in 0..<keys.count {
            c += blackPenalty(fingers[i], pitches[i])
            if i > 0 {
                let span = keys[i] - keys[i - 1]
                let limit = maxSpan(fingers[i - 1], fingers[i])
                if span > limit { c += Double(span - limit) * 12 }
                c += 0.3 * abs(Double(span - 2 * (fingers[i] - fingers[i - 1])))
            }
        }
        return c
    }

    /// Cost of moving from one event to the next, judged on the melody note
    /// (top note in the right hand, bottom note in the left — both are the last after mirroring).
    private static func transition(_ prevKeys: [Int], _ prev: [Int], _ keys: [Int], _ next: [Int]) -> Double {
        let p1 = prevKeys.last!, f1 = prev.last!
        let p2 = keys.last!, f2 = next.last!
        let d = p2 - p1

        if abs(d) > 12 { return 3 }                 // hand jumps to a new position
        if d == 0 { return f1 == f2 ? 0 : 1.5 }     // repeated key

        if f1 == f2 { return 9 }                    // same finger, different key

        if f2 > f1 {
            if d > 0 {
                var c = 0.5 * abs(Double(d - 2 * (f2 - f1)))
                let limit = maxSpan(f1, f2)
                if d > limit { c += Double(d - limit) * 4 }
                return c
            }
            // Finger crosses over the thumb going down.
            if f1 == 1, (3...4).contains(f2), d >= -5 { return 2 }
            if f1 == 1, f2 == 2, d >= -3 { return 3 }
            return 20
        } else {
            if d < 0 {
                var c = 0.5 * abs(Double(-d - 2 * (f1 - f2)))
                let limit = maxSpan(f1, f2)
                if -d > limit { c += Double(-d - limit) * 4 }
                return c
            }
            // Thumb passes under going up.
            if f2 == 1, (3...4).contains(f1), d <= 5 { return 2 }
            if f2 == 1, f1 == 2, d <= 3 { return 3 }
            return 20
        }
    }
}
