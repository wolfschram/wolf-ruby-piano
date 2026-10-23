import SwiftUI

/// A simple hand drawing (palm down, as you see your own hand) that lights the finger(s) to use.
struct HandGuideView: View {
    let hand: Hand
    let fingers: [Int]
    var dimmed = false

    // Finger lengths relative to the palm, thumb … pinky.
    private let lengths: [CGFloat] = [0.55, 0.9, 1.0, 0.92, 0.72]
    private let drops: [CGFloat] = [0.5, 0.06, 0.0, 0.06, 0.2]

    var body: some View {
        let color = Brand.handColor(hand)
        VStack(spacing: 6) {
            Canvas { ctx, size in
                let fingerW = size.width / 6.2
                let palmTop = size.height * 0.48
                let palm = CGRect(x: fingerW * 0.9, y: palmTop, width: fingerW * 4.4, height: size.height - palmTop)
                ctx.fill(Path(roundedRect: palm, cornerRadius: fingerW * 0.9), with: .color(Brand.surface3))

                for finger in 1...5 {
                    // Right hand: thumb on the left. Left hand: thumb on the right.
                    let slot = hand == .right ? finger - 1 : 5 - finger
                    let i = finger - 1
                    let x = fingerW * (0.4 + CGFloat(slot) * 1.12) + (finger == 1 ? (hand == .right ? -fingerW * 0.2 : fingerW * 0.2) : 0)
                    let top = palmTop * (1 - lengths[i]) + palmTop * drops[i] * 0.5
                    let rect = CGRect(x: x, y: top, width: fingerW, height: palmTop - top + fingerW * 0.8)
                    let on = fingers.contains(finger)
                    let path = Path(roundedRect: rect, cornerRadius: fingerW / 2)
                    ctx.fill(path, with: .color(on ? color : Brand.surface3))
                    if on { ctx.stroke(path, with: .color(Brand.ink.opacity(0.7)), lineWidth: 1.5) }
                    ctx.draw(Text("\(finger)").font(Brand.font(fingerW * 0.62, .bold))
                                .foregroundStyle(on ? Brand.goldInk : Brand.inkFaint),
                             at: CGPoint(x: rect.midX, y: rect.minY + fingerW * 0.62))
                }
            }
            .frame(width: 112, height: 96)
            Eyebrow(hand == .left ? "Left hand" : "Right hand", color: dimmed ? Brand.inkFaint : color)
        }
        .padding(10)
        .opacity(dimmed ? 0.45 : 1)
        .panel()
        .accessibilityElement()
        .accessibilityLabel("\(hand == .left ? "Left" : "Right") hand, finger \(fingers.map(String.init).joined(separator: " and "))")
    }
}
