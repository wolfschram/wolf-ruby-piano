import SwiftUI

/// Notes fall toward the keyboard. Block width = key, block length = how long to hold,
/// circle = which finger. The hand you are not practicing is dimmed.
struct FallingNotesView: View {
    let engine: PracticeEngine
    let layout: KeyLayout

    var body: some View {
        let t = engine.time
        let lookahead = 3.0 * max(engine.speed, 0.35)
        let practiced = engine.practicedHands
        let next = engine.nextNoteIDs
        let hit = engine.hitNoteIDs
        let notes = engine.song.notes
        let loop = engine.loopRange
        let hasLoop = engine.selectedPhrase != nil
        let waiting = engine.isWaiting

        Canvas { ctx, size in
            let h = size.height
            func y(_ songTime: Double) -> CGFloat { h - CGFloat((songTime - t) / lookahead) * h }

            // Lanes: faint guide at every C and F so the eye can find its place.
            for pitch in layout.whiteKeys where pitch % 12 == 0 || pitch % 12 == 5 {
                let x = layout.frame(of: pitch).x
                ctx.fill(Path(CGRect(x: x, y: 0, width: 1, height: h)),
                         with: .color(Brand.ink.opacity(pitch % 12 == 0 ? 0.09 : 0.04)))
            }

            // Loop end marker.
            if hasLoop {
                let ly = y(loop.end)
                if ly > 0 && ly < h {
                    ctx.fill(Path(CGRect(x: 0, y: ly, width: size.width, height: 1)), with: .color(Brand.gold.opacity(0.5)))
                }
            }

            // Notes: binary search the first note that might still be visible.
            var lo = 0, hi = notes.count
            while lo < hi {
                let mid = (lo + hi) / 2
                if notes[mid].start < t - 8 { lo = mid + 1 } else { hi = mid }
            }
            for note in notes[lo...].prefix(while: { $0.start < t + lookahead }) where note.end > t {
                guard layout.range.contains(note.pitch) else { continue }
                let f = layout.frame(of: note.pitch)
                let top = y(note.end), bottom = y(note.start)
                let rect = CGRect(x: f.x + 2, y: top, width: f.width - 4, height: max(bottom - top - 2, 6))
                let path = Path(roundedRect: rect, cornerRadius: 5)
                let color = Brand.handColor(note.hand)
                let active = practiced.isEmpty || practiced.contains(note.hand)
                let opacity = hit.contains(note.id) ? 0.25 : (active ? 0.92 : 0.28)
                ctx.fill(path, with: .color(color.opacity(opacity)))
                if NoteName.isBlack(note.pitch) {
                    ctx.fill(path, with: .color(Brand.canvas.opacity(0.28)))
                }
                if next.contains(note.id) {
                    ctx.stroke(path, with: .color(Brand.ink), lineWidth: waiting ? 3 : 2)
                }
                if active, let finger = note.finger, rect.height >= 20, f.width >= 16 {
                    let r = min(11, f.width / 2 - 2)
                    let c = CGPoint(x: rect.midX, y: rect.maxY - r - 4)
                    ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2)),
                             with: .color(Brand.canvas.opacity(0.85)))
                    ctx.draw(Text("\(finger)").font(Brand.font(r * 1.25, .bold)).foregroundStyle(color), at: c)
                }
            }

            // Hit line.
            ctx.fill(Path(CGRect(x: 0, y: h - 2, width: size.width, height: 2)),
                     with: .color(waiting ? Brand.gold : Brand.ink.opacity(0.3)))
        }
        .background(Brand.canvas)
        .clipped()
        .accessibilityHidden(true)
    }
}
