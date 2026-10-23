import SwiftUI

@main
struct WolfRubyPianoApp: App {
    init() {
        Brand.registerFonts()
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
