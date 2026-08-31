import Foundation

/// Native shell only switches Personal / Family / Business (no portals or extra space types).
enum WorkspaceKind: String, CaseIterable, Identifiable, Codable {
    case personal
    case family
    case business

    var id: String { rawValue }

    var title: String {
        switch self {
        case .personal: "Personal"
        case .family: "Family"
        case .business: "Business"
        }
    }

    var subtitle: String {
        switch self {
        case .personal: "Just you"
        case .family: "Home and household"
        case .business: "Studio and clients"
        }
    }

    var queryValue: String { rawValue }

    private static let storageKey = "so.ozer.app.workspace"

    static var stored: WorkspaceKind {
        if let raw = UserDefaults.standard.string(forKey: storageKey),
           let kind = WorkspaceKind(rawValue: raw) {
            return kind
        }
        return .personal
    }

    func persist() {
        UserDefaults.standard.set(rawValue, forKey: Self.storageKey)
    }
}
