import SwiftUI

@main
struct WolfRubyPianoApp: App {
    init() {
        Brand.registerFonts()
        // Keep cover photos and video thumbnails on the iPad so they show offline too.
        URLCache.shared = URLCache(memoryCapacity: 50_000_000, diskCapacity: 300_000_000)
    }

    var body: some Scene {
        WindowGroup {
            HomeView()
                .preferredColorScheme(.dark)
                .tint(Brand.gold)
                .statusBarHidden()
                .onAppear {
                    PianoSound.shared.start()
                    MIDIInput.shared.start()
                }
        }
    }
}
