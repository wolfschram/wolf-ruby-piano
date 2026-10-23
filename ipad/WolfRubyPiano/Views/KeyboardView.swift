import SwiftUI
import UIKit

/// On-screen keyboard: shows held keys, the keys to play next (with finger numbers),
/// and correct / wrong flashes. Multi-touch playable for practice without a piano.
struct KeyboardView: View {
    let engine: PracticeEngine
    let layout: KeyLayout

    var body: some View {
        let next = engine.song.notes.filter { engine.nextNoteIDs.contains($0.id) }
        let nextByPitch = Dictionary(next.map { ($0.pitch, $0) }, uniquingKeysWith: { a, _ in a })
        let pressed = engine.pressed
        let flashes = engine.flashes
        let showNames = engine.showNoteNames

        Canvas { ctx, size in
            let h = size.height
            let blackH = h * 0.62

            func fill(for pitch: Int, base: Color) -> Color {
                if let flash = flashes[pitch] { return flash == .correct ? Brand.ok : Brand.bad }
                if pressed.contains(pitch) {
                    if let note = nextByPitch[pitch] { return Brand.handColor(note.hand) }
                    return base == Brand.ink ? Color(hex: 0xC9D2E0) : Brand.surface3
                }
                return base
            }

            // White keys
            for pitch in layout.whiteKeys {
                let f = layout.frame(of: pitch)
                let rect = CGRect(x: f.x + 1, y: 0, width: f.width - 2, height: h)
                let path = Path(roundedRect: rect, cornerRadii: .init(bottomLeading: 5, bottomTrailing: 5))
                ctx.fill(path, with: .color(fill(for: pitch, base: Brand.ink)))
                if let note = nextByPitch[pitch], !pressed.contains(pitch) {
                    let tint = Brand.handColor(note.hand)
                    ctx.fill(path, with: .color(tint.opacity(0.55)))
                    ctx.stroke(path, with: .color(tint), lineWidth: 2)
                }
                if let note = nextByPitch[pitch], let finger = note.finger {
                    badge(ctx, finger, center: CGPoint(x: f.x + f.width / 2, y: h - 52), color: Brand.handColor(note.hand))
                }
                if showNames, pitch % 12 == 0 || nextByPitch[pitch] != nil {
                    let label = pitch % 12 == 0 ? "C\(pitch / 12 - 1)" : NoteName.name(pitch)
                    ctx.draw(Text(label).font(Brand.font(11, .semibold)).foregroundStyle(Brand.canvas.opacity(0.7)),
                             at: CGPoint(x: f.x + f.width / 2, y: h - 14))
                }
            }

            // Black keys
            for pitch in layout.range where NoteName.isBlack(pitch) {
                let f = layout.frame(of: pitch)
                let rect = CGRect(x: f.x, y: 0, width: f.width, height: blackH)
                let path = Path(roundedRect: rect, cornerRadii: .init(bottomLeading: 4, bottomTrailing: 4))
                ctx.fill(path, with: .color(fill(for: pitch, base: Brand.canvas)))
                if let note = nextByPitch[pitch], !pressed.contains(pitch) {
                    let tint = Brand.handColor(note.hand)
                    ctx.fill(path, with: .color(tint.opacity(0.7)))
                }
                ctx.stroke(path, with: .color(Brand.line), lineWidth: 1)
                if let note = nextByPitch[pitch], let finger = note.finger {
                    badge(ctx, finger, center: CGPoint(x: f.x + f.width / 2, y: blackH - 22), color: Brand.handColor(note.hand))
                }
            }

            // Top edge shadow, like the key bed lip.
            ctx.fill(Path(CGRect(x: 0, y: 0, width: size.width, height: 3)), with: .color(.black.opacity(0.5)))
        }
        .overlay(KeyTouchSurface(layout: layout, engine: engine))
        .accessibilityLabel("Piano keyboard")
    }

    private func badge(_ ctx: GraphicsContext, _ finger: Int, center: CGPoint, color: Color) {
        let r: CGFloat = 13
        let circle = Path(ellipseIn: CGRect(x: center.x - r, y: center.y - r, width: r * 2, height: r * 2))
        ctx.fill(circle, with: .color(Brand.canvas))
        ctx.stroke(circle, with: .color(color), lineWidth: 2)
        ctx.draw(Text("\(finger)").font(Brand.font(15, .bold)).foregroundStyle(color), at: center)
    }
}

/// Transparent multi-touch layer that turns touches into notes.
private struct KeyTouchSurface: UIViewRepresentable {
    let layout: KeyLayout
    let engine: PracticeEngine

    func makeUIView(context: Context) -> TouchView {
        let view = TouchView()
        view.isMultipleTouchEnabled = true
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ view: TouchView, context: Context) {
        view.layout = layout
        view.engine = engine
    }

    final class TouchView: UIView {
        var layout: KeyLayout?
        var engine: PracticeEngine?
        private var active: [ObjectIdentifier: Int] = [:]

        private func pitch(for touch: UITouch) -> Int? {
            guard let layout else { return nil }
            let p = touch.location(in: self)
            return layout.pitch(at: p.x, yFraction: p.y / max(bounds.height, 1))
        }

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
            for touch in touches {
                guard let pitch = pitch(for: touch) else { continue }
                active[ObjectIdentifier(touch)] = pitch
                engine?.noteOn(pitch, velocity: 90, fromScreen: true)
            }
        }

        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
            for touch in touches {
                let id = ObjectIdentifier(touch)
                guard let pitch = pitch(for: touch), pitch != active[id] else { continue }
                if let old = active[id] { engine?.noteOff(old, fromScreen: true) }
                active[id] = pitch
                engine?.noteOn(pitch, velocity: 90, fromScreen: true)
            }
        }

        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
            for touch in touches {
                if let pitch = active.removeValue(forKey: ObjectIdentifier(touch)) {
                    engine?.noteOff(pitch, fromScreen: true)
                }
            }
        }

        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
            touchesEnded(touches, with: event)
        }
    }
}
