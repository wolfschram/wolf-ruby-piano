import SwiftUI

/// Play a piece on the piano, listen back, and save it as a practice song with falling notes.
struct RecordView: View {
    var suggestedTitle = ""
    var onSaved: (SongEntry) -> Void = { _ in }

    @Environment(\.dismiss) private var dismiss
    @State private var recorder = Recorder()
    @State private var title = ""
    @State private var saveError: String?
    @State private var previous: (on: ((Int, Int) -> Void)?, off: ((Int) -> Void)?, sustain: ((Bool) -> Void)?)
    private let midi = MIDIInput.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            settings
            Spacer(minLength: 0)
            HStack {
                Spacer()
                VStack(spacing: 14) {
                    recordButton
                    status
                }
                Spacer()
            }
            HeldKeys(held: recorder.held)
                .frame(height: 90)
                .clipShape(RoundedRectangle(cornerRadius: Brand.rCard))
            Spacer(minLength: 0)
            if recorder.state == .finished { finishedActions }
        }
        .padding(28)
        .background(Brand.surface)
        .onAppear {
            title = suggestedTitle
            previous = (midi.onNoteOn, midi.onNoteOff, midi.onSustain)
            let recorder = recorder
            midi.onNoteOn = { pitch, velocity in recorder.noteOn(pitch, velocity: velocity) }
            midi.onNoteOff = { pitch in recorder.noteOff(pitch) }
            midi.onSustain = { down in recorder.sustain(down) }
        }
        .onDisappear {
            recorder.stop()
            recorder.stopPlayback()
            midi.onNoteOn = previous.on
            midi.onNoteOff = previous.off
            midi.onSustain = previous.sustain
        }
        .alert("Couldn't save", isPresented: .constant(saveError != nil)) {
            Button("OK") { saveError = nil }
        } message: {
            Text(saveError ?? "")
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Record your version").font(Brand.font(26, .bold)).foregroundStyle(Brand.ink)
                Text("Play it the way it should sound. It becomes a song with falling notes and finger numbers.")
                    .font(Brand.font(14)).foregroundStyle(Brand.inkDim)
            }
            Spacer()
            Button("Close") { dismiss() }.buttonStyle(CompactButtonStyle())
        }
    }

    private var settings: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Eyebrow("Name")
                TextField("Once Upon a Time in the West", text: $title)
                    .font(Brand.font(17, .semibold))
                    .foregroundStyle(Brand.ink)
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(Brand.field, in: RoundedRectangle(cornerRadius: Brand.rControl))
                    .overlay(RoundedRectangle(cornerRadius: Brand.rControl).stroke(Brand.line))
            }
            .frame(maxWidth: 420)

            VStack(alignment: .leading, spacing: 6) {
                Eyebrow("Metronome")
                HStack(spacing: 10) {
                    Toggle("Metronome", isOn: $recorder.metronome)
                        .labelsHidden()
                        .tint(Brand.gold)
                    if recorder.metronome {
                        Stepper("\(recorder.bpm) beats per minute", value: $recorder.bpm, in: 40...180, step: 2)
                            .font(Brand.font(14, .medium))
                            .foregroundStyle(Brand.ink)
                            .fixedSize()
                    } else {
                        Text("Off · starts on your first note").font(Brand.font(14)).foregroundStyle(Brand.inkDim)
                    }
                }
                .frame(height: 44)
            }
            .disabled(recorder.state == .recording)
            Spacer()
            if !midi.isConnected {
                StatusPill(text: "Connect your piano to record", color: Brand.warn)
            }
        }
    }

    private var recordButton: some View {
        let recording = recorder.state == .recording || isCountingIn
        return Button {
            recording ? recorder.stop() : recorder.start()
        } label: {
            ZStack {
                Circle().fill(Brand.surface3).frame(width: 120, height: 120)
                Circle().stroke(recording ? Brand.bad : Brand.line, lineWidth: 3).frame(width: 120, height: 120)
                if recording {
                    RoundedRectangle(cornerRadius: 8).fill(Brand.bad).frame(width: 40, height: 40)
                } else {
                    Circle().fill(Brand.bad).frame(width: 64, height: 64)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel(recording ? "Stop recording" : "Start recording")
        .animation(.easeOut(duration: 0.18), value: recording)
    }

    private var isCountingIn: Bool {
        if case .countIn = recorder.state { return true }
        return false
    }

    @ViewBuilder private var status: some View {
        switch recorder.state {
        case .ready:
            Text(recorder.takes.isEmpty ? "Tap to record" : "Ready")
                .font(Brand.font(16, .semibold)).foregroundStyle(Brand.inkDim)
        case .countIn(let n):
            Text("\(n)").font(Brand.font(44, .heavy)).foregroundStyle(Brand.gold)
        case .recording:
            TimelineView(.periodic(from: .now, by: 0.2)) { _ in
                VStack(spacing: 2) {
                    Text(clock(recorder.elapsed)).font(Brand.mono(28)).foregroundStyle(Brand.ink)
                    Text(recorder.takes.isEmpty ? "Waiting for your first note…" : "\(recorder.takes.count) notes")
                        .font(Brand.font(14)).foregroundStyle(Brand.inkDim)
                }
            }
        case .finished:
            VStack(spacing: 2) {
                Text(clock(recorder.duration)).font(Brand.mono(28)).foregroundStyle(Brand.ink)
                Text("\(recorder.takes.count) notes recorded").font(Brand.font(14)).foregroundStyle(Brand.inkDim)
            }
        }
    }

    private var finishedActions: some View {
        HStack(spacing: 12) {
            Button {
                recorder.isPlayingBack ? recorder.stopPlayback() : recorder.playBack()
            } label: {
                Label(recorder.isPlayingBack ? "Stop" : "Listen back",
                      systemImage: recorder.isPlayingBack ? "stop.fill" : "play.fill")
            }
            .buttonStyle(SecondaryButtonStyle())
            Button { recorder.discard() } label: { Label("Record again", systemImage: "arrow.counterclockwise") }
                .buttonStyle(SecondaryButtonStyle())
            Spacer()
            Button(action: save) { Label("Save as a song", systemImage: "checkmark") }
                .buttonStyle(PrimaryButtonStyle())
        }
    }

    private func save() {
        recorder.stopPlayback()
        do {
            let name = title.isEmpty ? "My recording" : title
            if let entry = try SongLibrary.shared.saveRecording(recorder.midiData(), title: name) {
                dismiss()
                onSaved(entry)
            }
        } catch {
            saveError = "The recording couldn't be turned into a song. Try recording again."
        }
    }

    private func clock(_ t: Double) -> String {
        String(format: "%d:%02d", Int(t) / 60, Int(t) % 60)
    }
}

/// Keys being held right now, C2–C7, so it's clear the piano is coming through.
private struct HeldKeys: View {
    let held: Set<Int>

    var body: some View {
        Canvas { ctx, size in
            let layout = KeyLayout(range: 36...96, width: size.width)
            for pitch in layout.whiteKeys {
                let f = layout.frame(of: pitch)
                let rect = CGRect(x: f.x + 1, y: 0, width: f.width - 2, height: size.height)
                ctx.fill(Path(roundedRect: rect, cornerRadius: 3),
                         with: .color(held.contains(pitch) ? Brand.gold : Brand.ink))
            }
            for pitch in layout.range where NoteName.isBlack(pitch) {
                let f = layout.frame(of: pitch)
                let rect = CGRect(x: f.x, y: 0, width: f.width, height: size.height * 0.6)
                ctx.fill(Path(roundedRect: rect, cornerRadius: 2),
                         with: .color(held.contains(pitch) ? Brand.gold : Brand.canvas))
            }
        }
        .accessibilityHidden(true)
    }
}
