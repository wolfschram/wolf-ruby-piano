import Foundation

/// Remembers clean passes per phrase. Three clean passes in "Wait for me" = mastered.
enum PracticeProgress {
    static let passesToMaster = 3

    private static func key(_ songID: String) -> String { "progress." + songID }

    static func passes(songID: String) -> [Int: Int] {
        guard let raw = UserDefaults.standard.dictionary(forKey: key(songID)) as? [String: Int] else { return [:] }
        return Dictionary(uniqueKeysWithValues: raw.compactMap { k, v in Int(k).map { ($0, v) } })
    }

    static func recordCleanPass(songID: String, phrase: Int) {
        var all = passes(songID: songID)
        all[phrase, default: 0] += 1
        UserDefaults.standard.set(Dictionary(uniqueKeysWithValues: all.map { (String($0.key), $0.value) }),
                                  forKey: key(songID))
    }

    static func reset(songID: String) {
        UserDefaults.standard.removeObject(forKey: key(songID))
    }

    static func masteredCount(songID: String) -> Int {
        passes(songID: songID).values.filter { $0 >= passesToMaster }.count
    }
}
