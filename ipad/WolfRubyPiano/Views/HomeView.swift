import SwiftUI
import UniformTypeIdentifiers

struct HomeView: View {
    @State private var path: [SongEntry] = []
    @State private var importing = false
    @State private var pairing = false
    @State private var importError: String?
    private let library = SongLibrary.shared
    private let midi = MIDIInput.shared
    private let sound = PianoSound.shared

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    if let featured = library.featured { featuredCard(featured) }
                    section(.exercise)
                    section(.wolf)
                    section(.imported)
                    section(.ruby)
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
        .alert("Import failed", isPresented: .constant(importError != nil)) {
            Button("OK") { importError = nil }
        } message: {
            Text(importError ?? "")
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            ProductLockup()
            Spacer()
            StatusPill(text: midi.isConnected ? "Piano: " + midi.deviceNames.joined(separator: ", ") : "No piano connected",
                       color: midi.isConnected ? Brand.ok : Brand.inkFaint)
            switch sound.status {
            case .loading(let p): StatusPill(text: "Loading piano sound \(Int(p * 100))%", color: Brand.warn)
            case .failed: Button("Retry piano sound") { sound.start() }.buttonStyle(SecondaryButtonStyle())
            default: EmptyView()
            }
            Button { pairing = true } label: { Label("Bluetooth piano", systemImage: "dot.radiowaves.left.and.right") }
                .buttonStyle(SecondaryButtonStyle())
            Button { importing = true } label: { Label("Import MIDI", systemImage: "square.and.arrow.down") }
                .buttonStyle(SecondaryButtonStyle())
        }
    }

    private func featuredCard(_ entry: SongEntry) -> some View {
        let mastered = PracticeProgress.masteredCount(songID: entry.id)
        return HStack(alignment: .center, spacing: 24) {
            VStack(alignment: .leading, spacing: 10) {
                Eyebrow("Your piece", color: Brand.gold)
                Text(entry.title)
                    .font(Brand.font(40, .heavy))
                    .tracking(-0.8)
                    .foregroundStyle(Brand.ink)
                Text("\(entry.artist) · Sergio Leone, 1968")
                    .font(Brand.font(16))
                    .foregroundStyle(Brand.inkDim)
                Text(mastered == 0
                     ? "Start with phrase 1 in Wait for me. The music waits until you press the right keys."
                     : "\(mastered) phrase\(mastered == 1 ? "" : "s") mastered. Keep going.")
                    .font(Brand.font(15))
                    .foregroundStyle(Brand.inkDim)
                    .padding(.top, 4)
            }
            Spacer()
            Button { path.append(entry) } label: {
                Label("Practice", systemImage: "play.fill").frame(minWidth: 140)
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding(28)
        .background(
            LinearGradient(colors: [Brand.surface2, Brand.surface], startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: Brand.rPanel)
        )
        .overlay(RoundedRectangle(cornerRadius: Brand.rPanel).stroke(Brand.line))
    }

    @ViewBuilder private func section(_ category: SongCategory) -> some View {
        let entries = library.entries(in: category).filter { $0.id != SongLibrary.featuredID }
        if !entries.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text(category.title).font(Brand.font(20, .bold)).foregroundStyle(Brand.ink)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 230), spacing: 12)], spacing: 12) {
                    ForEach(entries) { entry in
                        Button { path.append(entry) } label: { SongCard(entry: entry) }
                            .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

private struct SongCard: View {
    let entry: SongEntry

    var body: some View {
        let mastered = PracticeProgress.masteredCount(songID: entry.id)
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.title)
                .font(Brand.font(16, .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
            Text(entry.artist).font(Brand.font(13)).foregroundStyle(Brand.inkDim).lineLimit(1)
            Spacer(minLength: 0)
            HStack {
                HStack(spacing: 3) {
                    ForEach(1...5, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(i <= entry.difficulty ? Brand.inkDim : Brand.line)
                            .frame(width: 10, height: 4)
                    }
                }
                .accessibilityLabel("Difficulty \(entry.difficulty) of 5")
                Spacer()
                if mastered > 0 {
                    Text("\(mastered) mastered").font(Brand.font(12, .semibold)).foregroundStyle(Brand.ok)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
        .background(Brand.surface, in: RoundedRectangle(cornerRadius: Brand.rCard))
        .overlay(RoundedRectangle(cornerRadius: Brand.rCard).stroke(Brand.line))
        .contentShape(Rectangle())
    }
}
