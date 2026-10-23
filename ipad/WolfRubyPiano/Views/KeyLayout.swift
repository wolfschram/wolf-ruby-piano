import CoreGraphics

/// Shared geometry so falling notes line up exactly with the keys below them.
struct KeyLayout {
    let range: ClosedRange<Int>
    let width: CGFloat
    let whiteKeys: [Int]
    let whiteWidth: CGFloat

    init(range: ClosedRange<Int>, width: CGFloat) {
        // Never start or end on a black key.
        var lo = range.lowerBound, hi = range.upperBound
        if NoteName.isBlack(lo) { lo -= 1 }
        if NoteName.isBlack(hi) { hi += 1 }
        self.range = lo...hi
        self.width = width
        self.whiteKeys = (lo...hi).filter { !NoteName.isBlack($0) }
        self.whiteWidth = width / CGFloat(max(whiteKeys.count, 1))
    }

    var blackWidth: CGFloat { whiteWidth * 0.62 }

    /// Horizontal extent of a key.
    func frame(of pitch: Int) -> (x: CGFloat, width: CGFloat) {
        if NoteName.isBlack(pitch) {
            let leftWhite = whiteIndex(pitch - 1)
            let center = CGFloat(leftWhite + 1) * whiteWidth
            return (center - blackWidth / 2, blackWidth)
        }
        return (CGFloat(whiteIndex(pitch)) * whiteWidth, whiteWidth)
    }

    func whiteIndex(_ pitch: Int) -> Int {
        whiteKeys.firstIndex(of: pitch) ?? 0
    }

    /// Which key is under a touch point; black keys win in their upper part.
    func pitch(at x: CGFloat, yFraction: CGFloat) -> Int? {
        if yFraction < 0.62 {
            for pitch in range where NoteName.isBlack(pitch) {
                let f = frame(of: pitch)
                if x >= f.x && x <= f.x + f.width { return pitch }
            }
        }
        let i = Int(x / whiteWidth)
        return whiteKeys.indices.contains(i) ? whiteKeys[i] : nil
    }
}
