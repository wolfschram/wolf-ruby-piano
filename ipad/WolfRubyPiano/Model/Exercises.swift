import Foundation

/// Finger-training drills with fixed, correct fingering.
enum Exercises {
    private struct Step {
        let pitch: Int
        let finger: Int
        let hand: Hand
    }

    private static func make(id: String, title: String, difficulty: Int, bpm: Double, tip: String,
                             beatsPerNote: Double = 1, _ lines: [[Step]]) -> Song {
        // Each line is played one step per beat; lines play at the same time (hands together).
        let beat = 60 / bpm * beatsPerNote
        var notes: [NoteEvent] = []
        for line in lines {
            for (i, step) in line.enumerated() {
                notes.append(NoteEvent(id: 0, pitch: step.pitch, start: Double(i) * beat, duration: beat * 0.9,
                                       velocity: 80, hand: step.hand, finger: step.finger))
            }
        }
        notes.sort { $0.start == $1.start ? $0.pitch < $1.pitch : $0.start < $1.start }
        let numbered = notes.enumerated().map { i, n in
            NoteEvent(id: i, pitch: n.pitch, start: n.start, duration: n.duration,
                      velocity: n.velocity, hand: n.hand, finger: n.finger)
        }
        return Song(id: "ex-" + id, title: title, artist: "Finger training", category: .exercise,
                    difficulty: difficulty, notes: numbered, tip: tip)
    }

    private static func line(_ hand: Hand, _ pairs: [(Int, Int)]) -> [Step] {
        pairs.map { Step(pitch: $0.0, finger: $0.1, hand: hand) }
    }

    // MIDI pitches: C4 = 60 (middle C), C3 = 48.
    static let all: [Song] = {
        let up5 = [0, 2, 4, 5, 7]
        let rhFive = line(.right, (up5 + up5.reversed().dropFirst()).enumerated().map { i, s in
            (60 + s, i < 5 ? i + 1 : 9 - i)
        })
        let lhFive = line(.left, (up5 + up5.reversed().dropFirst()).enumerated().map { i, s in
            (48 + s, i < 5 ? 5 - i : i - 3)
        })

        let scale = [0, 2, 4, 5, 7, 9, 11, 12]
        let rhScaleFingers = [1, 2, 3, 1, 2, 3, 4, 5]
        let lhScaleFingers = [5, 4, 3, 2, 1, 3, 2, 1]
        let rhScale = line(.right, zip(scale + scale.reversed().dropFirst(),
                                       rhScaleFingers + rhScaleFingers.reversed().dropFirst()).map { (60 + $0, $1) })
        let lhScale = line(.left, zip(scale + scale.reversed().dropFirst(),
                                      lhScaleFingers + lhScaleFingers.reversed().dropFirst()).map { (48 + $0, $1) })

        // Hanon No. 1, first climb: C E F G A G F E, then the same from D, E …
        let hanonShape = [0, 4, 5, 7, 9, 7, 5, 4]
        let hanonFingers = [1, 2, 3, 4, 5, 4, 3, 2]
        let whiteSteps = [0, 2, 4, 5, 7, 9]
        var hanon: [(Int, Int)] = []
        for (n, root) in whiteSteps.enumerated() {
            for (s, f) in zip(hanonShape, hanonFingers) {
                // Keep the pattern on white keys by moving each shape note up the scale.
                hanon.append((60 + whiteKeyShift(root: root, step: s, n: n), f))
            }
        }

        let pairs = [(60, 1), (64, 3), (62, 2), (65, 4), (64, 3), (67, 5), (65, 4), (64, 3), (62, 2), (60, 1)]

        let triads: [(Int, Int)] = [(60, 1), (64, 3), (67, 5)]
        var chordLines: [[Step]] = [[], [], []]
        for root in [0, 5, 7, 0] {        // C, F, G, C
            for (k, t) in triads.enumerated() {
                chordLines[k].append(Step(pitch: t.0 + root, finger: t.1, hand: .right))
            }
        }

        return [
            make(id: "five-rh", title: "Five fingers · right hand", difficulty: 1, bpm: 70,
                 tip: "Thumb on middle C. One finger per key, C to G and back.", [rhFive]),
            make(id: "five-lh", title: "Five fingers · left hand", difficulty: 1, bpm: 70,
                 tip: "Pinky on the C below middle C. 5-4-3-2-1 up, then back.", [lhFive]),
            make(id: "five-both", title: "Five fingers · both hands", difficulty: 2, bpm: 60,
                 tip: "Same keys, mirror fingers: thumbs move in, pinkies move out.", [rhFive, lhFive]),
            make(id: "pairs", title: "Skipping fingers 1-3, 2-4, 3-5", difficulty: 2, bpm: 72,
                 tip: "Lift each finger cleanly. Keep the hand still, fingers do the work.", [line(.right, pairs)]),
            make(id: "scale-rh", title: "C scale · right hand", difficulty: 2, bpm: 72,
                 tip: "After E (3), tuck the thumb under to play F.", [rhScale]),
            make(id: "scale-lh", title: "C scale · left hand", difficulty: 2, bpm: 72,
                 tip: "After G (thumb), cross finger 3 over to play A.", [lhScale]),
            make(id: "hanon-1", title: "Hanon No. 1 · right hand", difficulty: 3, bpm: 84,
                 tip: "The same shape climbs one white key at a time. Even and relaxed.",
                 beatsPerNote: 0.5, [line(.right, hanon)]),
            make(id: "triads", title: "Chords C · F · G · C", difficulty: 2, bpm: 40,
                 tip: "Fingers 1-3-5 together. Move the whole hand, keep the shape.", chordLines),
        ]
    }()

    /// Moves a C-major shape so that every note stays on a white key.
    private static func whiteKeyShift(root: Int, step: Int, n: Int) -> Int {
        let whites = [0, 2, 4, 5, 7, 9, 11]
        let degree = whites.firstIndex(of: step % 12)! + n
        return whites[degree % 7] + 12 * (degree / 7)
    }
}
