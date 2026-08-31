import SwiftUI

struct RootView: View {
    @Environment(AppSession.self) private var session

    var body: some View {
        Group {
            switch session.phase {
            case .loading:
                ZStack {
                    OzerPalette.cream.ignoresSafeArea()
                    OzerFlowerMark(size: 64)
                }
            case .signedOut:
                SignInView()
            case .signedIn:
                MainTabView()
            }
        }
        .tint(OzerPalette.coral)
    }
}
