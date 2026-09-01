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
    private(set) var workspaces: [NativeWorkspace] = []
    private(set) var workspacesLoaded = false
    private(set) var isRefreshingWorkspaces = false
    private(set) var selectedWorkspace: NativeWorkspace?

    var lastError: String?

    private let auth = SupabaseAuthClient()
    private let api = NativeAPIClient()

    /// Slug or UUID for native `?workspace=`. Empty until a real membership is known.
    var workspaceQueryValue: String {
        if let selectedWorkspace {
            return selectedWorkspace.queryValue
        }
        if let stored = WorkspaceSelection.storedRef,
           !Self.legacyChipAliases.contains(stored.lowercased()) {
            return stored
        }
        return ""
    }

    /// Reload Today / Tasks when the selected account id changes, or the list first arrives.
    var workspaceContentKey: String {
        if let selectedWorkspace {
            return selectedWorkspace.id
        }
        return workspacesLoaded ? "empty" : "pending"
    }

    var selectedWorkspaceTitle: String {
        selectedWorkspace?.displayName ?? "Workspace"
    }

    var userEmail: String? { session?.email }

    func hydrate() {
        do {
            if let data = try KeychainStore.data(account: Self.keychainAccount) {
                session = try JSONDecoder().decode(AuthSession.self, from: data)
                phase = .signedIn
                Task { await refreshWorkspaces() }
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
            return "Check your email. If you opened it on this phone, tap the link. If you opened it on a computer, type the code here."
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    func verifyEmailOTP(email: String, token: String) async {
        lastError = nil
        do {
            let next = try await auth.verifyEmailOTP(email: email, token: token)
            try persist(next)
        } catch {
            lastError = error.localizedDescription
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
        workspaces = []
        workspacesLoaded = false
        selectedWorkspace = nil
        phase = .signedOut
        try? KeychainStore.deleteAll()
        if let token {
            await auth.signOut(accessToken: token)
        }
    }

    func selectWorkspace(_ workspace: NativeWorkspace) {
        selectedWorkspace = workspace
        WorkspaceSelection.persist(workspace)
    }

    func refreshWorkspaces() async {
        guard phase == .signedIn else { return }
        isRefreshingWorkspaces = true
        defer { isRefreshingWorkspaces = false }
        do {
            let token = try await validAccessToken()
            applyWorkspaces(try await api.workspaces(accessToken: token))
        } catch let error as NativeAPIError {
            workspacesLoaded = true
            if error == .unauthorized {
                await handleUnauthorized()
            }
        } catch {
            workspacesLoaded = true
        }
    }

    private func applyWorkspaces(_ incoming: [NativeWorkspace]) {
        workspaces = WorkspaceSelection.sorted(incoming)
        workspacesLoaded = true
        reconcileSelection()
    }

    private func reconcileSelection() {
        let next = WorkspaceSelection.resolve(
            storedRef: selectedWorkspace?.id ?? WorkspaceSelection.storedRef,
            in: workspaces
        )
        selectedWorkspace = next
        if let next {
            WorkspaceSelection.persist(next)
        }
    }

    private func persist(_ next: AuthSession) throws {
        let shouldLoadWorkspaces = phase != .signedIn
        let data = try JSONEncoder().encode(next)
        try KeychainStore.set(data, account: Self.keychainAccount)
        session = next
        phase = .signedIn
        if shouldLoadWorkspaces {
            Task { await refreshWorkspaces() }
        }
    }

    private static let legacyChipAliases: Set<String> = ["personal", "family", "business"]
}
