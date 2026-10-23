import Foundation
import Observation

struct SongEntry: Identifiable, Hashable {
    enum Source: Hashable {
        case bundle(String)      // file name in the app bundle
        case imported(URL)
        case exercise(String)
    }
    let id: String
    let title: String
    let artist: String
    let category: SongCategory
    let difficulty: Int
    let source: Source
    var isBandArrangement = false
}

@MainActor @Observable
final class SongLibrary {
    static let shared = SongLibrary()

    /// Wolf's main goal piece; shown first on the home screen.
    static let featuredID = "morricone-west"

    private(set) var entries: [SongEntry] = []
    @ObservationIgnored private var cache: [String: Song] = [:]

    private var importFolder: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let folder = docs.appendingPathComponent("Songs", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    init() { reload() }

    func reload() {
        var list: [SongEntry] = []
        struct CatalogRow: Decodable { let file, title, artist, category: String; let difficulty: Int }
        if let url = Bundle.main.url(forResource: "catalog", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let rows = try? JSONDecoder().decode([CatalogRow].self, from: data) {
            for row in rows {
                let id = (row.file as NSString).deletingPathExtension
                list.append(SongEntry(id: id, title: row.title, artist: row.artist,
                                      category: SongCategory(rawValue: row.category) ?? .wolf,
                                      difficulty: row.difficulty, source: .bundle(row.file)))
            }
        }
        for song in Exercises.all {
            list.append(SongEntry(id: song.id, title: song.title, artist: song.artist, category: .exercise,
                                  difficulty: song.difficulty, source: .exercise(song.id)))
        }
        let files = (try? FileManager.default.contentsOfDirectory(at: importFolder, includingPropertiesForKeys: nil)) ?? []
        for url in files.sorted(by: { $0.lastPathComponent < $1.lastPathComponent })
        where ["mid", "midi"].contains(url.pathExtension.lowercased()) {
            let name = url.deletingPathExtension().lastPathComponent
            list.append(SongEntry(id: "import-" + name, title: name.replacingOccurrences(of: "-", with: " "),
                                  artist: "Imported", category: .imported, difficulty: 3, source: .imported(url)))
        }
        for i in list.indices {
            if let url = fileURL(list[i].source), let data = try? Data(contentsOf: url),
               let result = try? MIDIFileParser.read(data) {
                list[i].isBandArrangement = result.isBandArrangement
            }
        }
        entries = list
    }

    private func fileURL(_ source: SongEntry.Source) -> URL? {
        switch source {
        case .bundle(let file): Bundle.main.url(forResource: (file as NSString).deletingPathExtension, withExtension: "mid")
        case .imported(let url): url
        case .exercise: nil
        }
    }

    func entries(in category: SongCategory) -> [SongEntry] {
        entries.filter { $0.category == category }
    }

    /// An imported piano version of Wolf's piece wins over the bundled orchestra file.
    var featured: SongEntry? {
        entries.first { $0.category == .imported && $0.title.lowercased().contains("west") && !$0.isBandArrangement }
            ?? entries.first { $0.id == Self.featuredID }
    }

    /// Copies a picked .mid file into the app so it stays available.
    func importFile(at url: URL) throws {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url)
        _ = try MIDIFileParser.parse(data)
        let target = importFolder.appendingPathComponent(url.lastPathComponent)
        try? FileManager.default.removeItem(at: target)
        try data.write(to: target)
        reload()
    }

    func load(_ entry: SongEntry) throws -> Song {
        if let song = cache[entry.id] { return song }
        var song: Song
        if case .exercise(let id) = entry.source {
            song = Exercises.all.first { $0.id == id }!
        } else {
            guard let url = fileURL(entry.source) else { throw MIDIFileParser.ParseError.notMIDI }
            let result = try MIDIFileParser.read(Data(contentsOf: url))
            song = Song(id: entry.id, title: entry.title, artist: entry.artist, category: entry.category,
                        difficulty: entry.difficulty, notes: result.notes, isBandArrangement: result.isBandArrangement,
                        bars: result.bars)
        }
        Fingering.apply(to: &song.notes)
        cache[entry.id] = song
        return song
    }
}
