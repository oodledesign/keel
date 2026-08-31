import AuthenticationServices
import Foundation
import UIKit

/// Bearer/JSON GoTrue client. No cookies. Tokens live in the Keychain only.
actor SupabaseAuthClient {
    private let session: URLSession
    private var pendingPKCE: PKCE.Pair?

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieAcceptPolicy = .never
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        session = URLSession(configuration: configuration)
    }

    func signInWithApple(idToken: String, rawNonce: String) async throws -> AuthSession {
        try requireAnonKey()
        let body: [String: String] = [
            "provider": "apple",
            "id_token": idToken,
            "nonce": rawNonce,
        ]
        return try await postToken(grantType: "id_token", body: body)
    }

    func signInWithGoogle() async throws -> AuthSession {
        try requireAnonKey()
        let pkce = PKCE.generate()
        pendingPKCE = pkce

        var components = URLComponents(
            url: AppConfiguration.supabaseURL.appending(path: "auth/v1/authorize"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: AppConfiguration.authCallbackURL.absoluteString),
            URLQueryItem(name: "code_challenge", value: pkce.challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
        ]

        guard let url = components?.url else {
            throw AuthError.transport("Could not build the Google sign-in URL.")
        }

        let callback = try await WebAuthPresenter.start(
            url: url,
            callbackScheme: AppConfiguration.authCallbackScheme
        )
        return try await handleRedirect(callback)
    }

    func sendMagicLink(email: String) async throws {
        try requireAnonKey()
        let pkce = PKCE.generate()
        pendingPKCE = pkce

        let body: [String: Any] = [
            "email": email,
            "create_user": true,
            "code_challenge": pkce.challenge,
            "code_challenge_method": "s256",
            "gotrue_meta_security": [String: String](),
            "options": [
                "email_redirect_to": AppConfiguration.authCallbackURL.absoluteString,
            ],
        ]

        var request = try authRequest(path: "auth/v1/otp")
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await send(request, expecting: [200, 201, 204])
    }

    func handleRedirect(_ url: URL) async throws -> AuthSession {
        let items = url.queryItemsIncludingFragment
        if let error = items["error"] ?? items["error_description"] {
            throw AuthError.server(error.replacingOccurrences(of: "+", with: " "))
        }

        if let access = items["access_token"], let refresh = items["refresh_token"] {
            pendingPKCE = nil
            return AuthSession(
                accessToken: access,
                refreshToken: refresh,
                expiresAt: expiresAt(from: items["expires_in"]),
                userId: items["user_id"] ?? "",
                email: items["email"]
            )
        }

        guard let code = items["code"] else {
            throw AuthError.missingAuthorizationCode
        }
        let verifier = pendingPKCE?.verifier
        pendingPKCE = nil
        var body: [String: String] = ["auth_code": code]
        if let verifier {
            body["code_verifier"] = verifier
        }
        return try await postToken(grantType: "pkce", body: body)
    }

    func refresh(refreshToken: String) async throws -> AuthSession {
        try requireAnonKey()
        return try await postToken(
            grantType: "refresh_token",
            body: ["refresh_token": refreshToken]
        )
    }

    func signOut(accessToken: String) async {
        guard AppConfiguration.isSupabaseConfigured else { return }
        var request = (try? authRequest(path: "auth/v1/logout")) ?? URLRequest(
            url: AppConfiguration.supabaseURL
        )
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        _ = try? await session.data(for: request)
    }

    private func postToken(grantType: String, body: [String: String]) async throws -> AuthSession {
        var request = try authRequest(path: "auth/v1/token")
        request.httpMethod = "POST"
        var components = URLComponents(url: request.url!, resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "grant_type", value: grantType)]
        request.url = components?.url
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data = try await send(request, expecting: [200])
        return try decodeSession(data)
    }

    private func decodeSession(_ data: Data) throws -> AuthSession {
        let payload = try JSONDecoder().decode(GoTrueSession.self, from: data)
        return AuthSession(
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresAt: payload.expiresAtDate,
            userId: payload.user?.id ?? "",
            email: payload.user?.email
        )
    }

    private func authRequest(path: String) throws -> URLRequest {
        try requireAnonKey()
        var request = URLRequest(url: AppConfiguration.supabaseURL.appending(path: path))
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(AppConfiguration.supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.httpShouldHandleCookies = false
        return request
    }

    @discardableResult
    private func send(_ request: URLRequest, expecting codes: Set<Int>) async throws -> Data {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AuthError.transport("No HTTP response.")
        }
        if codes.contains(http.statusCode) {
            return data
        }
        throw AuthError.server(Self.message(from: data) ?? "Sign-in failed (\(http.statusCode)).")
    }

    private func requireAnonKey() throws {
        guard AppConfiguration.isSupabaseConfigured else {
            throw AuthError.missingAnonKey
        }
    }

    private func expiresAt(from expiresIn: String?) -> Date? {
        guard let expiresIn, let seconds = TimeInterval(expiresIn) else { return nil }
        return Date().addingTimeInterval(seconds)
    }

    private static func message(from data: Data) -> String? {
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }
        if let message = json["error_description"] as? String { return message }
        if let message = json["msg"] as? String { return message }
        if let message = json["error"] as? String { return message }
        if let message = json["message"] as? String { return message }
        return nil
    }
}

private struct GoTrueSession: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: TimeInterval?
    let expiresAt: TimeInterval?
    let user: User?

    struct User: Decodable {
        let id: String
        let email: String?
    }

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case expiresAt = "expires_at"
        case user
    }

    var expiresAtDate: Date? {
        if let expiresAt {
            return Date(timeIntervalSince1970: expiresAt)
        }
        if let expiresIn {
            return Date().addingTimeInterval(expiresIn)
        }
        return nil
    }
}

enum WebAuthPresenter {
    @MainActor
    static func start(url: URL, callbackScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let holder = SessionHolder()
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: callbackScheme
            ) { callbackURL, error in
                holder.session = nil
                SessionHolder.retained = nil
                if let error {
                    let nsError = error as NSError
                    if nsError.domain == ASWebAuthenticationSessionError.errorDomain,
                       nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        continuation.resume(throwing: AuthError.cancelled)
                    } else {
                        continuation.resume(throwing: AuthError.transport(error.localizedDescription))
                    }
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: AuthError.missingAuthorizationCode)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = holder
            holder.session = session
            SessionHolder.retained = holder
            guard session.start() else {
                SessionHolder.retained = nil
                continuation.resume(throwing: AuthError.transport("Could not start the browser session."))
                return
            }
        }
    }
}

private final class SessionHolder: NSObject, ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    static var retained: SessionHolder?
    var session: ASWebAuthenticationSession?

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        keyWindow()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        keyWindow()
    }

    private func keyWindow() -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if let window = scenes.flatMap(\.windows).first(where: \.isKeyWindow) {
            return window
        }
        return scenes.flatMap(\.windows).first ?? ASPresentationAnchor()
    }
}

extension URL {
    var queryItemsIncludingFragment: [String: String] {
        var items: [String: String] = [:]
        if let queryItems = URLComponents(url: self, resolvingAgainstBaseURL: false)?.queryItems {
            for item in queryItems {
                if let value = item.value {
                    items[item.name] = value
                }
            }
        }
        if let fragment {
            let fragmentItems = URLComponents(string: "?\(fragment)")?.queryItems ?? []
            for item in fragmentItems {
                if let value = item.value {
                    items[item.name] = value
                }
            }
        }
        return items
    }
}
