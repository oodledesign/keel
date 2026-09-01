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

    /// Map the Personal / Family / Business chip to a real `/workspaces` row.
    /// Falls back to the chip alias so a naive query still hits the API resolver.
    func resolvedQueryValue(in workspaces: [NativeWorkspace]) -> String {
        matchingWorkspace(in: workspaces)?.queryValue ?? queryValue
    }

    func matchingWorkspace(in workspaces: [NativeWorkspace]) -> NativeWorkspace? {
        switch self {
        case .personal:
            return workspaces.first(where: { $0.isPersonal || $0.profile == "personal" })
        case .family:
            return workspaces.first(where: { $0.profile == "family" })
        case .business:
            return workspaces.first(where: { $0.profile == "work_design" })
                ?? workspaces.first(where: {
                    !$0.isPersonal && $0.profile != "personal" && $0.profile != "family"
                })
        }
    }

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
