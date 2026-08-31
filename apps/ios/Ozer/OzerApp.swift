import SwiftUI

@main
struct OzerApp: App {
    @State private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(.light)
                .task {
                    session.hydrate()
                }
                .onOpenURL { url in
                    Task { await session.handleOpenURL(url) }
                }
        }
    }
}
