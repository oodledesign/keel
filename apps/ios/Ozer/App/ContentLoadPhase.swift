import Foundation

/// First-paint presentation for screens that fetch remote lists.
/// Nil/empty fetch state is loading, not an error or empty copy.
enum ContentLoadPhase: Equatable {
    case skeleton
    case error
    case noWorkspaces
    case content

    static func resolve(
        workspacesLoaded: Bool,
        workspaceQueryEmpty: Bool,
        hasContent: Bool,
        hasError: Bool
    ) -> ContentLoadPhase {
        if workspacesLoaded && workspaceQueryEmpty {
            return .noWorkspaces
        }
        if hasContent {
            return .content
        }
        if hasError {
            return .error
        }
        return .skeleton
    }
}

/// Finances stay in a skeleton until a fetch finishes. "Unavailable" is failures only.
enum FinanceLoadPhase: Equatable {
    case skeleton
    case content
    case unavailable

    static func resolve(
        hasFinances: Bool,
        isLoading: Bool,
        loadFinished: Bool
    ) -> FinanceLoadPhase {
        if hasFinances {
            return .content
        }
        if isLoading || !loadFinished {
            return .skeleton
        }
        return .unavailable
    }
}
