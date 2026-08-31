import AuthenticationServices
import Foundation
import Observation

@MainActor
@Observable
final class AppSession {
    private static let keychainAccount = "supabase.session"

    enum Phase: Equatable {
        case loading
        case signedOut
        case signedIn
    }

    private(set) var phase: Phase = .loading
    private(set) var session: AuthSession?
    var workspace: WorkspaceKind = .stored {
        didSet { workspace.persist() }
    }

    var lastError: String?

    private let auth = SupabaseAuthClient()

    var userEmail: String? { session?.email }

    func hydrate() {
        do {
            if let data = try KeychainStore.data(account: Self.keychainAccount) {
                session = try JSONDecoder().decode(AuthSession.self, from: data)
                phase = .signedIn
            } else {
                session = nil
                phase = .signedOut
            }
        } catch {
            session = nil
            phase = .signedOut
        }
    }

    func completeAppleSignIn(authorization: ASAuthorization, rawNonce: String) async {
        lastError = nil
        do {
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let idToken = String(data: tokenData, encoding: .utf8) else {
                throw AuthError.missingIdentityToken
            }
            let next = try await auth.signInWithApple(idToken: idToken, rawNonce: rawNonce)
            try persist(next)
        } catch {
            lastError = error.localizedDescription
        }
    }

    func reportError(_ message: String) {
        lastError = message
    }

    func signInWithGoogle() async {
        lastError = nil
        do {
            let next = try await auth.signInWithGoogle()
            try persist(next)
        } catch {
            if let authError = error as? AuthError, case .cancelled = authError {
                return
            }
            lastError = error.localizedDescription
        }
    }

    func sendMagicLink(email: String) async -> String? {
        lastError = nil
        do {
            try await auth.sendMagicLink(email: email)
            return "Check your email for a sign-in link."
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    func handleOpenURL(_ url: URL) async {
        guard url.scheme == AppConfiguration.authCallbackScheme else { return }
        lastError = nil
        do {
            let next = try await auth.handleRedirect(url)
            try persist(next)
        } catch {
            lastError = error.localizedDescription
        }
    }

    func validAccessToken() async throws -> String {
        guard var current = session else {
            throw AuthError.server("You’re signed out.")
        }
        if current.isAccessTokenExpired {
            do {
                current = try await auth.refresh(refreshToken: current.refreshToken)
                try persist(current)
            } catch {
                await signOut()
                throw AuthError.server("Session expired. Please sign in again.")
            }
        }
        return current.accessToken
    }

    func handleUnauthorized() async {
        await signOut()
    }

    func signOut() async {
        let token = session?.accessToken
        session = nil
        phase = .signedOut
        try? KeychainStore.deleteAll()
        if let token {
            await auth.signOut(accessToken: token)
        }
    }

    private func persist(_ next: AuthSession) throws {
        let data = try JSONEncoder().encode(next)
        try KeychainStore.set(data, account: Self.keychainAccount)
        session = next
        phase = .signedIn
    }
}
