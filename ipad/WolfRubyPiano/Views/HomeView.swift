import SwiftUI
import UniformTypeIdentifiers

/// Section identities: each part of the library has its own colour so the home screen reads at a glance.
enum SectionTheme {
    case piece, fingers, film, mine, ruby

    var accent: Color {
        switch self {
        case .piece: Brand.gold
        case .fingers: Color(hex: 0xB7A8F5)
        case .film: Color(hex: 0x7FD6C6)
        case .mine: Brand.blue
        case .ruby: Color(hex: 0xF4A5C0)
        }
    }
    var tint: Color {
        switch self {
        case .piece: Color(hex: 0x2A1E0B)
        case .fingers: Color(hex: 0x1E1633)
        case .film: Color(hex: 0x10282A)
        case .mine: Color(hex: 0x111D33)
        case .ruby: Color(hex: 0x3A1626)
        }
    }
}

struct HomeView: View {
    @State private var path: [SongEntry] = []
    @State private var importing = false
    @State private var pairing = false
    @State private var importError: String?
    @State private var playingLesson: Lesson?
    @State private var showingKeys = false
    @State private var featuredPhrases: (total: Int, mastered: Int)?
    private let library = SongLibrary.shared
    private let midi = MIDIInput.shared
    private let sound = PianoSound.shared

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    header
                    featuredCard(library.featured)
                    fingerGym
                    songShelf(title: "Film & classical", subtitle: "Piano pieces to grow into",
                              theme: .film, entries: library.entries(in: .wolf))
                    songShelf(title: "Your imported songs", subtitle: "Added with Import MIDI",
                              theme: .mine, entries: library.entries(in: .imported))
                    rubyWorld
                }
                .padding(.horizontal, 32)
                .padding(.vertical, 24)
            }
            .background(Brand.canvas)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: SongEntry.self) { PracticeScreen(entry: $0) }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.midi], allowsMultipleSelection: true) { result in
            do {
                for url in try result.get() { try library.importFile(at: url) }
            } catch {
                importError = "That file could not be read as a MIDI song."
            }
        }
        .sheet(isPresented: $pairing) {
            BluetoothMIDIPairingView(onDone: { pairing = false })
        }
        .sheet(item: $playingLesson) { LessonPlayerSheet(lesson: $0) }
        .sheet(isPresented: $showingKeys) { PianoKeySettingsView() }
        .alert("Import failed", isPresented: .constant(importError != nil)) {
            Button("OK") { importError = nil }
        } message: {
            Text(importError ?? "")
        }
        .task(id: library.featured?.id) { loadFeaturedProgress() }
        .onChange(of: path) { _, new in if new.isEmpty { loadFeaturedProgress() } }
    }

    private func loadFeaturedProgress() {
        guard let entry = library.featured, let song = try? library.load(entry) else { return }
        featuredPhrases = (song.phrases().count, PracticeProgress.masteredCount(songID: entry.id))
    }

    // MARK: - Header

    private var greeting: String {
        switch Calendar.current.component(.hour, from: .now) {
        case 5..<12: "Good morning"
        case 12..<18: "Good afternoon"
        default: "Good evening"
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            ProductLockup()
            Spacer()
            StatusPill(text: midi.isConnected ? midi.deviceNames.joined(separator: ", ") : "No piano connected",
                       color: midi.isConnected ? Brand.ok : Brand.inkFaint)
            switch sound.status {
            case .loading(let p): StatusPill(text: "Loading piano \(Int(p * 100))%", color: Brand.warn)
            case .failed: Button("Retry sound") { sound.start() }.buttonStyle(CompactButtonStyle())
            default: EmptyView()
            }
            Button { showingKeys = true } label: { Label("Piano keys", systemImage: "pianokeys") }
                .buttonStyle(CompactButtonStyle())
            Button { pairing = true } label: { Label("Bluetooth", systemImage: "dot.radiowaves.left.and.right") }
                .buttonStyle(CompactButtonStyle())
            Button { importing = true } label: { Label("Import MIDI", systemImage: "square.and.arrow.down") }
                .buttonStyle(CompactButtonStyle())
        }
    }

    // MARK: - Your piece

    /// Original 1968 film poster (Wikipedia), loaded at runtime for Wolf's personal use.
    static let posterURL = URL(string: "https://upload.wikimedia.org/wikipedia/en/a/a2/Once_upon_a_Time_in_the_West.jpg")

    /// Best-rated solo piano arrangement found (Islam Albakov, MuseScore).
    static let pianoVersionURL = URL(string: "https://musescore.com/user/3270391/scores/5421927")!

    private func featuredCard(_ entry: SongEntry?) -> some View {
        let theme = SectionTheme.piece
        return HStack(alignment: .center, spacing: 24) {
            AsyncImage(url: Self.posterURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                SunsetArt()
            }
            .frame(width: 124, height: 186)
            .clipShape(RoundedRectangle(cornerRadius: Brand.rCard))
            .overlay(RoundedRectangle(cornerRadius: Brand.rCard).stroke(Brand.gold.opacity(0.4), lineWidth: 1))
            VStack(alignment: .leading, spacing: 8) {
                Text("\(greeting), Wolf · your piece").font(Brand.font(13, .semibold)).foregroundStyle(theme.accent)
                Text("Once Upon a Time in the West")
                    .font(Brand.font(34, .heavy))
                    .tracking(-0.6)
                    .foregroundStyle(Brand.ink)
                    .lineLimit(2)
                Text("Ennio Morricone · Sergio Leone, 1968")
                    .font(Brand.font(15))
                    .foregroundStyle(Brand.inkDim)
                if entry == nil {
                    Text("Add a solo piano version: download the MIDI from MuseScore, then Import MIDI. It lands here.")
                        .font(Brand.font(14))
                        .foregroundStyle(Brand.inkDim)
                        .padding(.top, 2)
                } else if let progress = featuredPhrases {
                    PhraseProgress(total: progress.total, mastered: progress.mastered)
                }
            }
            Spacer(minLength: 12)
            if let entry {
                Button { path.append(entry) } label: {
                    Label(featuredPhrases?.mastered ?? 0 > 0 ? "Continue" : "Start", systemImage: "play.fill")
                        .frame(minWidth: 110)
                }
                .buttonStyle(PrimaryButtonStyle())
            } else {
                VStack(alignment: .trailing, spacing: 8) {
                    Button { importing = true } label: {
                        Label("Import MIDI", systemImage: "square.and.arrow.down").frame(minWidth: 130)
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    Link(destination: Self.pianoVersionURL) {
                        Label("Piano version on MuseScore", systemImage: "arrow.up.right")
                    }
                    .buttonStyle(CompactButtonStyle())
                }
            }
        }
        .padding(20)
        .background(theme.tint, in: RoundedRectangle(cornerRadius: Brand.rPanel))
        .overlay(RoundedRectangle(cornerRadius: Brand.rPanel).stroke(theme.accent.opacity(0.35), lineWidth: 1))
    }

    // MARK: - Finger gym

    private var fingerGym: some View {
        let theme = SectionTheme.fingers
        return VStack(alignment: .leading, spacing: 14) {
            SectionHeader(title: "Finger gym", subtitle: "Watch a short video, then do the drill", theme: theme)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(library.entries(in: .exercise)) { entry in
                        Button { path.append(entry) } label: {
                            SongTile(entry: entry, theme: theme, symbol: "hand.raised.fingers.spread")
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            lessonRow(Lessons.adults, theme: theme)
        }
    }

    // MARK: - Song shelves

    @ViewBuilder
    private func songShelf(title: String, subtitle: String, theme: SectionTheme, entries: [SongEntry]) -> some View {
        let shown = entries.filter { $0.id != library.featured?.id }
        if !shown.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader(title: title, subtitle: subtitle, theme: theme)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 12)], spacing: 12) {
                    ForEach(shown) { entry in
                        Button { path.append(entry) } label: { SongTile(entry: entry, theme: theme, symbol: nil) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Ruby

    private var rubyWorld: some View {
        VStack(alignment: .leading, spacing: 14) {
            RubyWorldSection()
            Text("Videos for Ruby").font(Brand.font(15, .semibold)).foregroundStyle(SectionTheme.ruby.accent)
            lessonRow(Lessons.kids, theme: .ruby)
            let songs = library.entries(in: .ruby)
            if !songs.isEmpty {
                Text("All of Ruby's songs").font(Brand.font(15, .semibold)).foregroundStyle(SectionTheme.ruby.accent)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 200), spacing: 12)], spacing: 12) {
                    ForEach(songs) { entry in
                        Button { path.append(entry) } label: { SongTile(entry: entry, theme: .ruby, symbol: nil) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func lessonRow(_ lessons: [Lesson], theme: SectionTheme) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 14) {
                ForEach(lessons) { lesson in
                    Button { playingLesson = lesson } label: { LessonCard(lesson: lesson, accent: theme.accent) }
                        .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Pieces

struct CompactButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Brand.font(13, .semibold))
            .foregroundStyle(Brand.ink)
            .padding(.horizontal, 12)
            .frame(minHeight: 36)
            .background(Capsule().fill(configuration.isPressed ? Brand.surface3 : Brand.surface2))
            .overlay(Capsule().stroke(Brand.line, lineWidth: 1))
    }
}

private struct SectionHeader: View {
    let title: String
    let subtitle: String
    let theme: SectionTheme
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            RoundedRectangle(cornerRadius: 2).fill(theme.accent).frame(width: 4, height: 18)
            Text(title).font(Brand.font(22, .bold)).foregroundStyle(Brand.ink)
            Text(subtitle).font(Brand.font(14)).foregroundStyle(Brand.inkDim)
        }
    }
}

private struct PhraseProgress: View {
    let total: Int
    let mastered: Int
    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 3) {
                ForEach(0..<min(total, 40), id: \.self) { i in
                    Capsule()
                        .fill(i < mastered ? Brand.ok : (i == mastered ? Brand.gold : Brand.surface3))
                        .frame(width: 12, height: 6)
                }
            }
            Text("\(mastered) of \(total) phrases mastered")
                .font(Brand.font(13, .medium))
                .foregroundStyle(Brand.inkDim)
        }
        .padding(.top, 4)
        .accessibilityElement(children: .combine)
    }
}

private struct SongTile: View {
    let entry: SongEntry
    let theme: SectionTheme
    let symbol: String?

    var body: some View {
        let mastered = PracticeProgress.masteredCount(songID: entry.id)
        VStack(alignment: .leading, spacing: 0) {
            Group {
                if let cover = CoverImages.bySongID[entry.id] ?? CoverImages.bySongID["default-piano"] {
                    AsyncImage(url: cover.url, transaction: Transaction(animation: .easeOut(duration: 0.26))) { phase in
                        if let image = phase.image {
                            image.resizable().aspectRatio(contentMode: .fill)
                        } else {
                            CoverArt(seed: entry.title, accent: theme.accent, symbol: symbol)
                        }
                    }
                    .accessibilityLabel(cover.credit)
                } else {
                    CoverArt(seed: entry.title, accent: theme.accent, symbol: symbol)
                }
            }
            .frame(height: 110)
            .frame(maxWidth: .infinity)
            .clipped()
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title)
                    .font(Brand.font(15, .semibold))
                    .foregroundStyle(Brand.ink)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(entry.artist).font(Brand.font(12)).foregroundStyle(Brand.inkDim).lineLimit(1)
                    Spacer(minLength: 4)
                    if entry.isBandArrangement {
                        Text("Band file").font(Brand.font(11, .semibold)).foregroundStyle(Brand.warn)
                    } else if mastered > 0 {
                        Label("\(mastered)", systemImage: "checkmark.seal.fill")
                            .font(Brand.font(11, .semibold)).foregroundStyle(Brand.ok)
                    } else {
                        DifficultyDots(level: entry.difficulty, color: theme.accent)
                    }
                }
            }
            .padding(12)
        }
        .frame(width: symbol == nil ? nil : 210)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.tint, in: RoundedRectangle(cornerRadius: Brand.rCard))
        .clipShape(RoundedRectangle(cornerRadius: Brand.rCard))
        .overlay(RoundedRectangle(cornerRadius: Brand.rCard).stroke(theme.accent.opacity(0.18), lineWidth: 1))
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

private struct DifficultyDots: View {
    let level: Int
    let color: Color
    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { i in
                Circle().fill(i <= level ? color : Brand.line).frame(width: 5, height: 5)
            }
        }
        .accessibilityLabel("Difficulty \(level) of 5")
    }
}

/// Generated cover art: soft overlapping shapes from the title, so every song looks different.
struct CoverArt: View {
    let seed: String
    let accent: Color
    var symbol: String?

    var body: some View {
        let hash = seed.unicodeScalars.reduce(UInt64(5381)) { ($0 &* 33) &+ UInt64($1.value) }
        Canvas { ctx, size in
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(accent.opacity(0.16)))
            for i in 0..<4 {
                let bits = hash >> UInt64(i * 12)
                let x = CGFloat(bits & 0xFF) / 255 * size.width
                let y = CGFloat((bits >> 8) & 0xF) / 15 * size.height
                let r = size.height * (0.5 + CGFloat(i) * 0.22)
                ctx.fill(Path(ellipseIn: CGRect(x: x - r / 2, y: y - r / 2, width: r, height: r)),
                         with: .color(accent.opacity(0.10 + Double(i) * 0.06)))
            }
            // A few "keys" along the bottom edge.
            let keyW = size.width / 14
            for k in 0..<14 {
                ctx.fill(Path(CGRect(x: CGFloat(k) * keyW + 1, y: size.height - 10, width: keyW - 2, height: 10)),
                         with: .color(accent.opacity(0.22)))
            }
        }
        .overlay(alignment: .topLeading) {
            Group {
                if let symbol {
                    Image(systemName: symbol).font(.system(size: 26, weight: .semibold))
                } else {
                    Text(String(seed.prefix(1))).font(Brand.font(40, .heavy))
                }
            }
            .foregroundStyle(accent)
            .padding(12)
        }
        .accessibilityHidden(true)
    }
}

/// Cover for the Western: sun setting behind mesas.
private struct SunsetArt: View {
    var body: some View {
        Canvas { ctx, size in
            let w = size.width, h = size.height
            ctx.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(hex: 0x3B2410)))
            ctx.fill(Path(CGRect(x: 0, y: 0, width: w, height: h * 0.62)), with: .color(Color(hex: 0x8A4B1C)))
            ctx.fill(Path(ellipseIn: CGRect(x: w * 0.3, y: h * 0.3, width: w * 0.4, height: w * 0.4)),
                     with: .color(Brand.gold))
            var mesa = Path()
            mesa.move(to: CGPoint(x: 0, y: h * 0.62))
            mesa.addLine(to: CGPoint(x: w * 0.08, y: h * 0.5))
            mesa.addLine(to: CGPoint(x: w * 0.3, y: h * 0.5))
            mesa.addLine(to: CGPoint(x: w * 0.36, y: h * 0.6))
            mesa.addLine(to: CGPoint(x: w * 0.68, y: h * 0.6))
            mesa.addLine(to: CGPoint(x: w * 0.74, y: h * 0.44))
            mesa.addLine(to: CGPoint(x: w * 0.94, y: h * 0.44))
            mesa.addLine(to: CGPoint(x: w, y: h * 0.56))
            mesa.addLine(to: CGPoint(x: w, y: h))
            mesa.addLine(to: CGPoint(x: 0, y: h))
            ctx.fill(mesa, with: .color(Color(hex: 0x1C1209)))
            ctx.fill(Path(CGRect(x: 0, y: h * 0.82, width: w, height: 2)), with: .color(Brand.gold.opacity(0.3)))
        }
        .accessibilityHidden(true)
    }
}
