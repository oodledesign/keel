import Foundation

enum AppConfiguration {
    static var apiBaseURL: URL {
        url(for: "OZER_API_BASE", fallback: "https://app.ozer.so")
    }

    static var supabaseURL: URL {
        url(for: "OZER_SUPABASE_URL", fallback: "https://igewpbdkvvhclfprteca.supabase.co")
    }

    /// Public anon key from Info.plist / xcconfig. Empty in git on purpose.
    static var supabaseAnonKey: String {
        string(for: "OZER_SUPABASE_ANON_KEY")
    }

    static var isSupabaseConfigured: Bool {
        !supabaseAnonKey.isEmpty
    }

    static var authCallbackURL: URL {
        URL(string: "so.ozer.app://auth-callback")!
    }

    static var authCallbackScheme: String {
        "so.ozer.app"
    }

    private static func string(for key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private static func url(for key: String, fallback: String) -> URL {
        let raw = string(for: key)
        if let url = URL(string: raw), url.scheme != nil {
            return url
        }
        return URL(string: fallback)!
    }
}
