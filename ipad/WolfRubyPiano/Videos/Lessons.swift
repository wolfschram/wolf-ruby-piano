import SwiftUI
import WebKit

/// Short teaching videos (links confirmed 22 Oct 2026).
struct Lesson: Identifiable, Hashable {
    let id: String          // YouTube video id
    let title: String
    let channel: String
    let minutes: String
    let forKids: Bool

    var thumbnail: URL { URL(string: "https://i.ytimg.com/vi/\(id)/hqdefault.jpg")! }
    var watchURL: URL { URL(string: "https://www.youtube.com/watch?v=\(id)")! }
}

enum Lessons {
    static let kids: [Lesson] = [
        Lesson(id: "zIO4VMEFybY", title: "Finger numbers", channel: "Hoffman Academy", minutes: "7 min", forKids: true),
        Lesson(id: "vS89ItM21-c", title: "Find C and play C Boogie", channel: "Hoffman Academy", minutes: "8 min", forKids: true),
        Lesson(id: "aovVKP02noU", title: "C lives left of two black keys", channel: "Dan Barrow Music", minutes: "2 min", forKids: true),
        Lesson(id: "3fUr8Jf4x38", title: "Five fingers on C", channel: "The Piano Mama", minutes: "5 min", forKids: true),
        Lesson(id: "LZqGmUFVEXc", title: "Finger games on the table", channel: "Hoffman Academy", minutes: "5 min", forKids: true),
        Lesson(id: "kDGVLIj2rss", title: "Bubble hands", channel: "Pianoberries", minutes: "1 min", forKids: true),
    ]

    static let adults: [Lesson] = [
        Lesson(id: "N7IIVWvSyRQ", title: "Hand position", channel: "Dylan Laine", minutes: "2 min", forKids: false),
        Lesson(id: "rZznie6UU_o", title: "Hand posture", channel: "Pianote", minutes: "2 min", forKids: false),
        Lesson(id: "yluVIQ0psdo", title: "Five-finger patterns", channel: "Liberty Park Music", minutes: "2 min", forKids: false),
        Lesson(id: "lJPqIXrbt_o", title: "The thumb tuck", channel: "Pianote", minutes: "3 min", forKids: false),
        Lesson(id: "AcLfNC9d02s", title: "How to practise Hanon", channel: "Emma Blair", minutes: "7 min", forKids: false),
        Lesson(id: "ngc0VUe-LV0", title: "Hand independence", channel: "Pianote", minutes: "6 min", forKids: false),
        Lesson(id: "0FwiKlvqRqQ", title: "Five-finger patterns and chords", channel: "Mario Ajero", minutes: "3 min", forKids: false),
        Lesson(id: "13Qa9mpCHo0", title: "How to practise", channel: "Jazer Lee", minutes: "6 min", forKids: false),
    ]

    /// The video that goes with each finger drill.
    static func forExercise(_ songID: String) -> Lesson? {
        let byID = Dictionary(uniqueKeysWithValues: (kids + adults).map { ($0.id, $0) })
        switch songID {
        case "ex-five-rh", "ex-five-lh", "ex-five-both": return byID["yluVIQ0psdo"]
        case "ex-pairs": return byID["ngc0VUe-LV0"]
        case "ex-scale-rh", "ex-scale-lh": return byID["lJPqIXrbt_o"]
        case "ex-hanon-1": return byID["AcLfNC9d02s"]
        case "ex-triads": return byID["0FwiKlvqRqQ"]
        default: return nil
        }
    }
}

struct LessonCard: View {
    let lesson: Lesson
    var accent: Color = Brand.gold

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ZStack {
                AsyncImage(url: lesson.thumbnail) { image in
                    image.resizable().aspectRatio(16 / 9, contentMode: .fill)
                } placeholder: {
                    Rectangle().fill(Brand.surface3)
                }
                .frame(height: 112)
                .clipped()
                Image(systemName: "play.fill")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Brand.canvas)
                    .frame(width: 42, height: 42)
                    .background(accent, in: Circle())
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
            Text(lesson.title)
                .font(Brand.font(15, .semibold))
                .foregroundStyle(Brand.ink)
                .lineLimit(2)
            Text("\(lesson.channel) · \(lesson.minutes)")
                .font(Brand.font(12))
                .foregroundStyle(Brand.inkDim)
                .lineLimit(1)
        }
        .frame(width: 200, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Video: \(lesson.title), \(lesson.minutes)")
    }
}

/// Plays a lesson inside the app, with a way out to the YouTube app.
struct LessonPlayerSheet: View {
    let lesson: Lesson
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(lesson.title).font(Brand.font(18, .bold)).foregroundStyle(Brand.ink)
                    Text("\(lesson.channel) · \(lesson.minutes)").font(Brand.font(13)).foregroundStyle(Brand.inkDim)
                }
                Spacer()
                Button { openURL(lesson.watchURL) } label: { Label("Open in YouTube", systemImage: "arrow.up.right") }
                    .buttonStyle(SecondaryButtonStyle())
                Button("Done") { dismiss() }
                    .buttonStyle(PrimaryButtonStyle())
            }
            .padding(16)
            YouTubePlayer(videoID: lesson.id)
                .aspectRatio(16 / 9, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: Brand.rCard))
                .padding([.horizontal, .bottom], 16)
        }
        .background(Brand.surface)
    }
}

private struct YouTubePlayer: UIViewRepresentable {
    let videoID: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        let html = """
        <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
        <body><iframe src="https://www.youtube-nocookie.com/embed/\(videoID)?playsinline=1&rel=0&modestbranding=1"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
        """
        view.loadHTMLString(html, baseURL: URL(string: "https://schram-fam.wolfrubypiano.app"))
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}
}
