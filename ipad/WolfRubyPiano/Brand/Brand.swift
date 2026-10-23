import SwiftUI
import CoreText

// Schram Media family tokens (schram-media-brand skill): Archivo, gold #E6B45C, canvas #090C11.
enum Brand {
    static let canvas = Color(hex: 0x090C11)
    static let surface = Color(hex: 0x10141C)
    static let surface2 = Color(hex: 0x151A22)
    static let surface3 = Color(hex: 0x1B222D)
    static let field = Color(hex: 0x0D1117)
    static let ink = Color(hex: 0xEAEFF7)
    static let inkDim = Color(hex: 0x9AA7BA)
    static let inkFaint = Color(hex: 0x8B98AD)
    static let gold = Color(hex: 0xE6B45C)
    static let goldInk = Color(hex: 0x211603)
    static let blue = Color(hex: 0x9FBDF2)
    static let ok = Color(hex: 0x79C995)
    static let warn = Color(hex: 0xD8B45C)
    static let bad = Color(hex: 0xE1817D)
    static let line = Color(hex: 0xEAEFF7).opacity(0.14)

    // Hand coding (product-specific): left hand = technical blue, right hand = family gold.
    static let leftHand = blue
    static let rightHand = gold
    static func handColor(_ hand: Hand) -> Color { hand == .left ? leftHand : rightHand }

    static let rControl: CGFloat = 6
    static let rCard: CGFloat = 10
    static let rPanel: CGFloat = 14

    static func registerFonts() {
        guard let url = Bundle.main.url(forResource: "Archivo", withExtension: "ttf") else { return }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
    }

    static func font(_ size: CGFloat, _ weight: Font.Weight = .regular, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("ArchivoRoman-Regular", size: size, relativeTo: style).weight(weight)
    }

    static func mono(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }
}
