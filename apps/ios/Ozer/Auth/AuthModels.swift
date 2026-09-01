import Foundation

struct AuthSession: Codable, Equatable {
    var accessToken: String
    var refreshToken: String
    var expiresAt: Date?
    var userId: String
    var email: String?

    var isAccessTokenExpired: Bool {
        guard let expiresAt else { return false }
        return expiresAt.addingTimeInterval(-60) <= Date()
    }
}

enum AuthError: LocalizedError {
    case missingAnonKey
    case cancelled
    case missingIdentityToken
    case missingAuthorizationCode
    case server(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .missingAnonKey:
            return "Add OZER_SUPABASE_ANON_KEY in Config/Local.xcconfig, then rebuild."
        case .cancelled:
            return "Sign-in was cancelled."
        case .missingIdentityToken:
            return "Apple did not return an identity token."
        case .missingAuthorizationCode:
            return "The sign-in redirect did not include an auth code. Type the 8-digit email code in Ozer instead."
        case .server(let message), .transport(let message):
            return message
        }
    }
}
