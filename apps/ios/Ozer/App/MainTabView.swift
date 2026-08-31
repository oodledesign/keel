import SwiftUI

struct MainTabView: View {
    @State private var screen: AppScreen = .home
    @State private var menuOpen = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch screen {
                case .home:
                    HomeTodayView()
                case .tasks:
                    StubFeatureView(feature: .tasks)
                case .notes:
                    StubFeatureView(feature: .notes)
                case .people:
                    StubFeatureView(feature: .people)
                case .shopping:
                    StubFeatureView(feature: .shopping)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if !menuOpen {
                OzerTabBar(screen: $screen, menuOpen: $menuOpen)
            }
        }
        .fullScreenCover(isPresented: $menuOpen) {
            MenuView(
                onOpen: { next in
                    screen = next
                    menuOpen = false
                },
                onClose: { menuOpen = false }
            )
        }
    }
}

struct OzerTabBar: View {
    @Binding var screen: AppScreen
    @Binding var menuOpen: Bool

    var body: some View {
        HStack(spacing: 2) {
            tabButton(systemImage: "house", label: "Home", selected: screen == .home) {
                screen = .home
            }
            ForEach(PinSlot.allCases) { pin in
                tabButton(
                    systemImage: pin.feature.symbol,
                    label: pin.feature.title,
                    selected: screen == pin.screen
                ) {
                    screen = pin.screen
                }
            }
            tabButton(systemImage: "line.3.horizontal", label: "Menu", selected: false) {
                menuOpen = true
            }
        }
        .padding(.horizontal, 6)
        .frame(height: 48)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay {
            Capsule().stroke(OzerPalette.border, lineWidth: 1)
        }
        .shadow(color: OzerPalette.shadow, radius: 16, y: 6)
        .padding(.bottom, 12)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Primary")
    }

    private func tabButton(
        systemImage: String,
        label: String,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(selected ? Color.white : OzerPalette.plumMuted)
                .frame(width: 40, height: 40)
                .background(selected ? OzerPalette.coral : Color.clear, in: Circle())
        }
        .accessibilityLabel(label)
        .buttonStyle(.plain)
    }
}
