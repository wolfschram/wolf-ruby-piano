import SwiftUI

struct Eyebrow: View {
    var text: String
    var color: Color = Brand.inkFaint
    init(_ text: String, color: Color = Brand.inkFaint) { self.text = text; self.color = color }
    var body: some View {
        Text(text.uppercased())
            .font(Brand.font(11, .semibold, relativeTo: .caption))
            .tracking(1)
            .foregroundStyle(color)
    }
}

/// Family mark + product name, top-left in first-party chrome.
struct ProductLockup: View {
    var compact = false
    var body: some View {
        HStack(spacing: 10) {
            Image("OrbitMark")
                .resizable()
                .interpolation(.high)
                .frame(width: compact ? 28 : 36, height: compact ? 28 : 36)
                .accessibilityLabel("Schram Media")
            VStack(alignment: .leading, spacing: 1) {
                Text("Wolf & Ruby Piano")
                    .font(Brand.font(compact ? 16 : 20, .bold))
                    .foregroundStyle(Brand.ink)
                if !compact {
                    Eyebrow("Schram Media · Visual piano")
                }
            }
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Brand.font(15, .bold))
            .foregroundStyle(Brand.goldInk)
            .padding(.horizontal, 18)
            .frame(minHeight: 44)
            .background(Brand.gold, in: RoundedRectangle(cornerRadius: Brand.rControl))
            .brightness(configuration.isPressed ? -0.06 : 0)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    var active = false
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(Brand.font(14, .semibold))
            .foregroundStyle(active ? Brand.gold : Brand.ink)
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(
                RoundedRectangle(cornerRadius: Brand.rControl)
                    .fill(configuration.isPressed ? Brand.surface3 : Brand.surface2)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Brand.rControl)
                    .stroke(active ? Brand.gold : Brand.line, lineWidth: 1)
            )
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Segmented control in family language: neutral well, gold active segment.
struct Segmented<T: Hashable>: View {
    let options: [(T, String)]
    @Binding var selection: T

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.0) { value, label in
                Button {
                    selection = value
                } label: {
                    Text(label)
                        .font(Brand.font(14, selection == value ? .bold : .medium))
                        .foregroundStyle(selection == value ? Brand.goldInk : Brand.inkDim)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 40)
                        .background(
                            RoundedRectangle(cornerRadius: Brand.rControl - 1)
                                .fill(selection == value ? Brand.gold : .clear)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .background(Brand.field, in: RoundedRectangle(cornerRadius: Brand.rControl + 1))
        .overlay(RoundedRectangle(cornerRadius: Brand.rControl + 1).stroke(Brand.line, lineWidth: 1))
        .animation(.easeOut(duration: 0.18), value: selection)
    }
}

struct StatusPill: View {
    var text: String
    var color: Color
    var body: some View {
        HStack(spacing: 7) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text)
                .font(Brand.font(13, .medium))
                .foregroundStyle(Brand.inkDim)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 32)
        .background(Brand.surface2, in: Capsule())
        .overlay(Capsule().stroke(Brand.line, lineWidth: 1))
    }
}

extension View {
    func panel() -> some View {
        self
            .background(Brand.surface.opacity(0.88), in: RoundedRectangle(cornerRadius: Brand.rPanel))
            .overlay(RoundedRectangle(cornerRadius: Brand.rPanel).stroke(Brand.line, lineWidth: 1))
    }
}
