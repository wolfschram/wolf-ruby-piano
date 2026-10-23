import SwiftUI

struct PracticeScreen: View {
    let entry: SongEntry
    @State private var engine: PracticeEngine?
    @State private var error: String?

    var body: some View {
        Group {
            if let engine {
                PracticeView(engine: engine)
            } else if let error {
                VStack(spacing: 12) {
                    Text("Could not open this song").font(Brand.font(20, .bold)).foregroundStyle(Brand.ink)
                    Text(error).font(Brand.font(14)).foregroundStyle(Brand.inkDim)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Brand.canvas)
            } else {
                ProgressView().tint(Brand.gold)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Brand.canvas)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task {
            do {
                let song = try SongLibrary.shared.load(entry)
                engine = PracticeEngine(song: song)
            } catch {
                self.error = "The MIDI file could not be read."
            }
        }
    }
}

struct PracticeView: View {
    @Bindable var engine: PracticeEngine
    @Environment(\.dismiss) private var dismiss
    private let midi = MIDIInput.shared
    private let sound = PianoSound.shared

    var body: some View {
        VStack(spacing: 0) {
            topBar
            phraseStrip
            GeometryReader { geo in
                let layout = KeyLayout(range: engine.keyRange, width: geo.size.width)
                VStack(spacing: 0) {
                    ZStack {
                        FallingNotesView(engine: engine, layout: layout)
                        overlays
                    }
                    KeyboardView(engine: engine, layout: layout)
                        .frame(height: min(190, geo.size.height * 0.34))
                }
            }
            transportBar
        }
        .background(Brand.canvas)
        .onAppear(perform: connectInput)
        .onDisappear {
            engine.stop()
            midi.onNoteOn = nil
            midi.onNoteOff = nil
            midi.onSustain = nil
        }
    }

    private func connectInput() {
        let engine = engine
        midi.onNoteOn = { pitch, velocity in engine.noteOn(pitch, velocity: velocity, fromScreen: false) }
        midi.onNoteOff = { pitch in engine.noteOff(pitch, fromScreen: false) }
        midi.onSustain = { down in engine.sustain(down) }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: 14) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left").font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .foregroundStyle(Brand.ink)
            .accessibilityLabel("Back to songs")

            Image("OrbitMark").resizable().frame(width: 26, height: 26)

            VStack(alignment: .leading, spacing: 1) {
                Text(engine.song.title).font(Brand.font(17, .bold)).foregroundStyle(Brand.ink).lineLimit(1)
                Text(engine.song.artist).font(Brand.font(12)).foregroundStyle(Brand.inkDim).lineLimit(1)
            }
            .frame(maxWidth: 260, alignment: .leading)

            Spacer(minLength: 8)

            Segmented(options: [(PracticeEngine.Mode.listen, "Listen"),
                                 (.wait, "Wait for me"),
                                 (.flow, "Play along")],
                      selection: $engine.mode)

            Segmented(options: [(PracticeEngine.HandChoice.left, "Left"),
                                 (.both, "Both"),
                                 (.right, "Right")],
                      selection: $engine.handChoice)
                .opacity(engine.mode == .listen ? 0.4 : 1)
                .disabled(engine.mode == .listen)

            speedControl

            Menu {
                Toggle("iPad plays the other hand", isOn: $engine.accompany)
                Toggle("iPad plays my piano keys too", isOn: $engine.playMyKeys)
                Toggle("Show note names", isOn: $engine.showNoteNames)
            } label: {
                Image(systemName: "slider.horizontal.3").font(.system(size: 17, weight: .medium))
                    .frame(width: 44, height: 44)
                    .foregroundStyle(Brand.ink)
                    .background(Brand.surface2, in: RoundedRectangle(cornerRadius: Brand.rControl))
                    .overlay(RoundedRectangle(cornerRadius: Brand.rControl).stroke(Brand.line))
            }
            .accessibilityLabel("Sound and display options")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Brand.surface)
        .overlay(alignment: .bottom) { Rectangle().fill(Brand.line).frame(height: 1) }
    }

    private var speedControl: some View {
        HStack(spacing: 0) {
            Button { engine.speed = max(0.25, engine.speed - 0.05) } label: {
                Image(systemName: "minus").frame(width: 36, height: 40)
            }
            Text("\(Int((engine.speed * 100).rounded()))%")
                .font(Brand.mono(14))
                .foregroundStyle(Brand.ink)
                .frame(width: 52)
            Button { engine.speed = min(1.5, engine.speed + 0.05) } label: {
                Image(systemName: "plus").frame(width: 36, height: 40)
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Brand.inkDim)
        .padding(2)
        .background(Brand.field, in: RoundedRectangle(cornerRadius: Brand.rControl + 1))
        .overlay(RoundedRectangle(cornerRadius: Brand.rControl + 1).stroke(Brand.line))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Speed \(Int(engine.speed * 100)) percent")
    }

    // MARK: - Phrases

    private var phraseStrip: some View {
        HStack(spacing: 12) {
            Eyebrow("Phrases")
            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        phraseChip(label: "Whole song", index: nil)
                        ForEach(engine.phrases) { phrase in
                            phraseChip(label: "\(phrase.id + 1)", index: phrase.id).id(phrase.id)
                        }
                    }
                    .padding(.vertical, 6)
                }
                .onChange(of: engine.currentPhrase) { _, new in
                    if engine.selectedPhrase == nil, let new { withAnimation(.easeOut(duration: 0.26)) { proxy.scrollTo(new, anchor: .center) } }
                }
            }
            Toggle(isOn: $engine.buildBackward) {
                Text("Build backward").font(Brand.font(14, .semibold)).foregroundStyle(Brand.ink)
            }
            .toggleStyle(.switch)
            .tint(Brand.gold)
            .fixedSize()
            .disabled(engine.selectedPhrase == nil)
            .opacity(engine.selectedPhrase == nil ? 0.4 : 1)
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .background(Brand.surface.opacity(0.6))
    }

    private func phraseChip(label: String, index: Int?) -> some View {
        let selected = engine.selectedPhrase == index
        let current = index != nil && engine.currentPhrase == index && engine.selectedPhrase == nil
        let mastered = index.map(engine.isMastered) ?? false
        let passes = index.flatMap { engine.passes[$0] } ?? 0
        return Button {
            engine.selectPhrase(index)
        } label: {
            HStack(spacing: 6) {
                Text(label).font(Brand.font(14, selected ? .bold : .medium))
                if index != nil {
                    HStack(spacing: 2) {
                        ForEach(0..<PracticeProgress.passesToMaster, id: \.self) { i in
                            Circle()
                                .fill(i < passes ? (selected ? Brand.goldInk : Brand.ok) : (selected ? Brand.goldInk.opacity(0.25) : Brand.line))
                                .frame(width: 5, height: 5)
                        }
                    }
                }
            }
            .foregroundStyle(selected ? Brand.goldInk : (mastered ? Brand.ok : Brand.ink))
            .padding(.horizontal, 12)
            .frame(minWidth: 44, minHeight: 40)
            .background(selected ? Brand.gold : Brand.surface2, in: RoundedRectangle(cornerRadius: Brand.rControl))
            .overlay(RoundedRectangle(cornerRadius: Brand.rControl)
                .stroke(current ? Brand.ink.opacity(0.5) : (selected ? Brand.gold : Brand.line), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(index == nil ? "Whole song" : "Phrase \(label)\(mastered ? ", mastered" : "")")
    }

    // MARK: - Overlays

    private var overlays: some View {
        ZStack {
            if engine.mode != .listen {
                VStack {
                    Spacer()
                    HStack(alignment: .bottom) {
                        HandGuideView(hand: .left, fingers: engine.nextFingers(for: .left),
                                      dimmed: !engine.practicedHands.contains(.left))
                        Spacer()
                        HandGuideView(hand: .right, fingers: engine.nextFingers(for: .right),
                                      dimmed: !engine.practicedHands.contains(.right))
                    }
                }
                .padding(12)
                .allowsHitTesting(false)
            }

            VStack(spacing: 8) {
                if let tip = engine.song.tip {
                    Text(tip)
                        .font(Brand.font(15, .medium))
                        .foregroundStyle(Brand.ink)
                        .padding(.horizontal, 16).padding(.vertical, 10)
                        .panel()
                }
                if engine.mode == .wait, engine.isWaiting {
                    Text("Your turn — play the outlined keys")
                        .font(Brand.font(14, .semibold))
                        .foregroundStyle(Brand.gold)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .panel()
                        .transition(.opacity)
                }
                if let message = engine.message {
                    Text(message)
                        .font(Brand.font(22, .bold))
                        .foregroundStyle(Brand.ink)
                        .padding(.horizontal, 22).padding(.vertical, 14)
                        .panel()
                        .transition(.opacity.combined(with: .scale(scale: 0.96)))
                }
                Spacer()
            }
            .padding(.top, 14)
            .animation(.easeOut(duration: 0.18), value: engine.message)
            .animation(.easeOut(duration: 0.18), value: engine.isWaiting)
            .allowsHitTesting(false)
        }
    }

    // MARK: - Transport

    private var transportBar: some View {
        HStack(spacing: 10) {
            Button { engine.stepBack() } label: {
                Label("Step back", systemImage: "backward.end.fill")
            }
            .buttonStyle(SecondaryButtonStyle())

            Button { engine.togglePlay() } label: {
                Label(engine.isPlaying ? "Pause" : "Play", systemImage: engine.isPlaying ? "pause.fill" : "play.fill")
                    .frame(minWidth: 96)
            }
            .buttonStyle(PrimaryButtonStyle())
            .keyboardShortcut(.space, modifiers: [])

            Button { engine.pause(); engine.restartLoop() } label: {
                Label("Restart", systemImage: "arrow.counterclockwise")
            }
            .buttonStyle(SecondaryButtonStyle())

            progressBar

            StatusPill(text: midi.isConnected ? midi.deviceNames.joined(separator: ", ") : "No piano connected",
                       color: midi.isConnected ? Brand.ok : Brand.inkFaint)
                .frame(maxWidth: 220)
            soundPill
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Brand.surface)
        .overlay(alignment: .top) { Rectangle().fill(Brand.line).frame(height: 1) }
    }

    private var progressBar: some View {
        let duration = max(engine.song.duration, 0.1)
        let fraction = min(1, max(0, engine.time / duration))
        return VStack(alignment: .leading, spacing: 4) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Brand.field)
                    if let p = engine.selectedPhrase, engine.phrases.indices.contains(p) {
                        let phrase = engine.phrases[p]
                        Capsule().fill(Brand.gold.opacity(0.35))
                            .frame(width: max(4, geo.size.width * (phrase.end - phrase.start) / duration))
                            .offset(x: geo.size.width * phrase.start / duration)
                    }
                    Capsule().fill(Brand.ink.opacity(0.8)).frame(width: max(4, geo.size.width * fraction))
                }
                .contentShape(Rectangle())
                .gesture(DragGesture(minimumDistance: 0).onChanged { value in
                    engine.seek(Double(value.location.x / geo.size.width) * duration)
                })
            }
            .frame(height: 6)
            Text("\(clock(max(engine.time, 0)))  /  \(clock(duration))")
                .font(Brand.mono(11, .medium))
                .foregroundStyle(Brand.inkFaint)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 8)
    }

    @ViewBuilder private var soundPill: some View {
        switch sound.status {
        case .ready: EmptyView()
        case .loading(let p): StatusPill(text: "Loading piano \(Int(p * 100))%", color: Brand.warn)
        case .failed: Button("Retry piano sound") { sound.start() }.buttonStyle(SecondaryButtonStyle())
        case .idle: StatusPill(text: "Piano sound off", color: Brand.inkFaint)
        }
    }

    private func clock(_ t: Double) -> String {
        let s = Int(t)
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
