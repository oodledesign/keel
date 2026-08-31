import CryptoKit
import Foundation

enum PKCE {
    struct Pair {
        let verifier: String
        let challenge: String
    }

    static func generate() -> Pair {
        let verifier = randomURLSafe(byteCount: 32)
        let hash = SHA256.hash(data: Data(verifier.utf8))
        return Pair(verifier: verifier, challenge: Data(hash).base64URLEncodedString())
    }

    static func randomURLSafe(byteCount: Int) -> String {
        var bytes = [UInt8](repeating: 0, count: byteCount)
        let result = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        if result != errSecSuccess {
            bytes = (0 ..< byteCount).map { _ in UInt8.random(in: 0 ... 255) }
        }
        return Data(bytes).base64URLEncodedString()
    }

    static func sha256Hex(_ value: String) -> String {
        let hash = SHA256.hash(data: Data(value.utf8))
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}

extension Data {
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
