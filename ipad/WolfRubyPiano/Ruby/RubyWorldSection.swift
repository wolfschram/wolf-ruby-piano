import SwiftUI

/// Home-screen section: "Ruby's world" with three big game tiles.
struct RubyWorldSection: View {
    @State private var openLevel: RubyLevel?
    @State private var refresh = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 14) {
                Text("Ruby's world")
                    .font(Brand.font(30, .heavy))
                    .foregroundStyle(LinearGradient(colors: [Color(hex: 0xF27BA6), Color(hex: 0xB98AF0)],
                                                    startPoint: .leading, endPoint: .trailing))
                Text("🐻 🦆 🐸 🐳 🐭")
                    .font(.system(size: 22))
                Spacer()
                Eyebrow("Play with the animals", color: Color(hex: 0xE7A8D0))
            }

            HStack(spacing: 18) {
                ForEach(RubyLevel.allCases) { level in
                    Button { openLevel = level } label: {
                        RubyLevelTile(level: level, stars: RubyStars.total(for: level))
                    }
                    .buttonStyle(RubySquishStyle())
                    .id("\(level.rawValue)-\(refresh)")
                }
            }
        }
        .fullScreenCover(item: $openLevel, onDismiss: { refresh += 1 }) { level in
            if level == .fingers {
                RubyGameView(mode: .fingers)
            } else {
                RubySongPicker(level: level)
            }
        }
    }
}

private struct RubyLevelTile: View {
    let level: RubyLevel
    let stars: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(level.animals)
                    .font(.system(size: level == .fiveKeys ? 34 : 46))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Spacer()
                Text("⭐️ \(stars)")
                    .font(Brand.font(18, .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(.black.opacity(0.22)))
            }
            Spacer(minLength: 0)
            Text(level.title)
                .font(Brand.font(26, .heavy))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            HStack {
                Text(level.subtitle)
                    .font(Brand.font(15, .semibold))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Image(systemName: "play.fill")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(level.gradient[1])
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(.white))
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 200, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(LinearGradient(colors: level.gradient, startPoint: .topLeading, endPoint: .bottomTrailing))
        )
        .overlay(RoundedRectangle(cornerRadius: 28, style: .continuous).strokeBorder(.white.opacity(0.2)))
        .shadow(color: level.gradient[1].opacity(0.35), radius: 14, y: 8)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(level.title), \(stars) stars")
    }
}

struct RubySquishStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .brightness(configuration.isPressed ? -0.04 : 0)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

/// Song tiles inside a level; tapping one starts the game.
struct RubySongPicker: View {
    let level: RubyLevel
    @Environment(\.dismiss) private var dismiss
    @State private var playing: RubySong?
    @State private var refresh = 0
    private var book: RubySongBook { RubySongBook.shared }

    var body: some View {
        let songs = book.songs(for: level)
        ZStack(alignment: .topLeading) {
            LinearGradient(colors: [Color(hex: 0x2B1740), Color(hex: 0x120C1E)], startPoint: .top, endPoint: .bottom)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 24) {
                HStack(spacing: 18) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 64, height: 64)
                            .background(Circle().fill(Color.white.opacity(0.16)))
                    }
                    .accessibilityLabel("Close")
                    VStack(alignment: .leading, spacing: 2) {
                        Text(level.title)
                            .font(Brand.font(34, .heavy))
                            .foregroundStyle(.white)
                        Text(level.animals).font(.system(size: 28))
                    }
                }

                ScrollView {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 230, maximum: 320), spacing: 20)], spacing: 20) {
                        ForEach(songs) { song in
                            Button { playing = song } label: {
                                RubySongTile(song: song, stars: RubyStars.best(level: level, itemID: song.id))
                            }
                            .buttonStyle(RubySquishStyle())
                        }
                    }
                    .id(refresh)
                    .padding(.bottom, 40)
                }
            }
            .padding(.horizontal, 32)
            .padding(.top, 28)
        }
        .onAppear { book.scanLibraryIfNeeded() }
        .fullScreenCover(item: $playing, onDismiss: { refresh += 1 }) { song in
            RubyGameView(mode: .song(song))
        }
    }
}

private struct RubySongTile: View {
    let song: RubySong
    let stars: Int

    var body: some View {
        let firstAnimals = song.notes.prefix(5).map(\.finger.animal).joined()
        let tint = song.notes.first?.finger.color ?? .pink
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(song.emoji).font(.system(size: 56))
                Spacer()
                HStack(spacing: 2) {
                    ForEach(0..<3, id: \.self) { i in
                        Text("⭐️").font(.system(size: 20)).opacity(i < stars ? 1 : 0.22)
                    }
                }
            }
            Text(song.title)
                .font(Brand.font(22, .bold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            Text(firstAnimals)
                .font(.system(size: 22))
            if song.fromLibrary {
                Eyebrow("From Ruby's songs", color: .white.opacity(0.6))
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [tint.opacity(0.55), Color(hex: 0x3A2154)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
        )
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).strokeBorder(.white.opacity(0.18)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(song.title), \(stars) stars")
    }
}
