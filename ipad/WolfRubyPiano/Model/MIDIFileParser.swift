import Foundation

/// Reads Standard MIDI Files (format 0 and 1) into notes with times in seconds.
enum MIDIFileParser {
    enum ParseError: Error { case notMIDI, truncated }

    private struct RawNote {
        let track: Int
        let pitch: Int
        let velocity: Int
        let startTick: Int
        let endTick: Int
    }

    static func parse(_ data: Data) throws -> [NoteEvent] {
        let bytes = [UInt8](data)
        var reader = Reader(bytes: bytes)

        guard reader.ascii(4) == "MThd" else { throw ParseError.notMIDI }
        let headerLength = try reader.u32()
        _ = try reader.u16() // format
        let trackCount = try reader.u16()
        let division = try reader.u16()
        reader.pos += Int(headerLength) - 6

        var ticksPerQuarter = Double(division)
        var smpteTicksPerSecond: Double?
        if division & 0x8000 != 0 {
            let fps = Double(256 - Int(division >> 8))
            smpteTicksPerSecond = fps * Double(division & 0xFF)
            ticksPerQuarter = 480
        }

        var tempos: [(tick: Int, usPerQuarter: Double)] = [(0, 500_000)]
        var raw: [RawNote] = []

        for track in 0..<Int(trackCount) {
            guard reader.pos + 8 <= bytes.count else { break }
            let id = reader.ascii(4)
            let length = Int(try reader.u32())
            let end = min(reader.pos + length, bytes.count)
            guard id == "MTrk" else { reader.pos = end; continue }

            var tick = 0
            var running: UInt8 = 0
            var open: [Int: [(tick: Int, velocity: Int)]] = [:]   // key: channel*128+pitch

            while reader.pos < end {
                tick += try reader.varLen()
                var status = try reader.u8()
                if status < 0x80 {
                    status = running
                    reader.pos -= 1
                } else if status < 0xF0 {
                    running = status
                }

                switch status {
                case 0xFF:
                    let type = try reader.u8()
                    let len = try reader.varLen()
                    if type == 0x51, len == 3 {
                        let us = (Int(try reader.u8()) << 16) | (Int(try reader.u8()) << 8) | Int(try reader.u8())
                        tempos.append((tick, Double(us)))
                    } else {
                        reader.pos += len
                    }
                case 0xF0, 0xF7:
                    reader.pos += try reader.varLen()
                default:
                    let kind = status & 0xF0
                    let channel = Int(status & 0x0F)
                    switch kind {
                    case 0x80, 0x90:
                        let pitch = Int(try reader.u8())
                        let velocity = Int(try reader.u8())
                        let key = channel * 128 + pitch
                        if kind == 0x90 && velocity > 0 {
                            open[key, default: []].append((tick, velocity))
                        } else if var stack = open[key], !stack.isEmpty {
                            let on = stack.removeFirst()
                            open[key] = stack
                            if channel != 9 { // skip General MIDI drums
                                raw.append(RawNote(track: track, pitch: pitch, velocity: on.velocity,
                                                   startTick: on.tick, endTick: max(tick, on.tick + 1)))
                            }
                        }
                    case 0xA0, 0xB0, 0xE0:
                        reader.pos += 2
                    case 0xC0, 0xD0:
                        reader.pos += 1
                    default:
                        reader.pos = end
                    }
                }
            }
            reader.pos = end
        }

        // Tick → seconds using the merged tempo map.
        tempos.sort { $0.tick < $1.tick }
        func seconds(_ tick: Int) -> Double {
            if let tps = smpteTicksPerSecond { return Double(tick) / tps }
            var time = 0.0
            var lastTick = 0
            var us = 500_000.0
            for change in tempos {
                if change.tick >= tick { break }
                time += Double(change.tick - lastTick) * us / ticksPerQuarter / 1_000_000
                lastTick = change.tick
                us = change.usPerQuarter
            }
            return time + Double(tick - lastTick) * us / ticksPerQuarter / 1_000_000
        }

        let hands = assignHands(raw)
        var notes = raw.enumerated().map { i, n in
            NoteEvent(id: 0, pitch: n.pitch, start: seconds(n.startTick),
                      duration: max(0.05, seconds(n.endTick) - seconds(n.startTick)),
                      velocity: n.velocity, hand: hands[i], finger: nil)
        }
        notes.sort { $0.start == $1.start ? $0.pitch < $1.pitch : $0.start < $1.start }

        // Start the song right away instead of after a long silent intro.
        let offset = max(0, (notes.first?.start ?? 0) - 0.5)
        return notes.enumerated().map { i, n in
            NoteEvent(id: i, pitch: n.pitch, start: n.start - offset, duration: n.duration,
                      velocity: n.velocity, hand: n.hand, finger: nil)
        }
    }

    /// Two note tracks → higher one is the right hand. Otherwise split by pitch.
    private static func assignHands(_ raw: [RawNote]) -> [Hand] {
        let tracks = Dictionary(grouping: raw, by: \.track)
        if tracks.count == 2 {
            let averages = tracks.mapValues { notes in Double(notes.map(\.pitch).reduce(0, +)) / Double(notes.count) }
            let rightTrack = averages.max { $0.value < $1.value }!.key
            return raw.map { $0.track == rightTrack ? .right : .left }
        }
        let pitches = raw.map(\.pitch)
        if let lo = pitches.min(), let hi = pitches.max(), hi - lo <= 14 {
            return raw.map { _ in lo >= 55 ? .right : .left }
        }
        return raw.map { $0.pitch >= 60 ? .right : .left }
    }

    private struct Reader {
        let bytes: [UInt8]
        var pos = 0

        mutating func u8() throws -> UInt8 {
            guard pos < bytes.count else { throw ParseError.truncated }
            defer { pos += 1 }
            return bytes[pos]
        }
        mutating func u16() throws -> UInt16 { (UInt16(try u8()) << 8) | UInt16(try u8()) }
        mutating func u32() throws -> UInt32 { (UInt32(try u16()) << 16) | UInt32(try u16()) }
        mutating func ascii(_ n: Int) -> String {
            guard pos + n <= bytes.count else { pos = bytes.count; return "" }
            defer { pos += n }
            return String(bytes: bytes[pos..<pos + n], encoding: .ascii) ?? ""
        }
        mutating func varLen() throws -> Int {
            var value = 0
            for _ in 0..<4 {
                let b = try u8()
                value = (value << 7) | Int(b & 0x7F)
                if b & 0x80 == 0 { break }
            }
            return value
        }
    }
}
