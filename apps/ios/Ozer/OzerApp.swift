import SwiftUI

@main
struct OzerApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var session = AppSession()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .preferredColorScheme(.light)
                .task {
                    NetworkPathMonitor.shared.start()
                    session.hydrate()
                }
                .onOpenURL { url in
                    Task { await session.handleOpenURL(url) }
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        Task { await session.flushOfflineWork() }
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: .ozerNetworkBecameOnline)) { _ in
                    Task { await session.flushOfflineWork() }
                }
        }
    }
}
