import Foundation
import Network
import Observation

extension Notification.Name {
    static let ozerNetworkBecameOnline = Notification.Name("so.ozer.app.network.online")
}

/// Tiny reachability helper so queued notes flush on reconnect.
@MainActor
@Observable
final class NetworkPathMonitor {
    static let shared = NetworkPathMonitor()

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "so.ozer.app.network")
    private(set) var isOnline = true
    private var started = false

    func start() {
        guard !started else { return }
        started = true
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self else { return }
                let online = path.status == .satisfied
                let becameOnline = online && !self.isOnline
                self.isOnline = online
                if becameOnline {
                    NotificationCenter.default.post(name: .ozerNetworkBecameOnline, object: nil)
                }
            }
        }
        monitor.start(queue: queue)
    }
}
