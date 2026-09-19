import Foundation

enum MemoryMediaKind: String, Equatable {
    case image
    case video
    case audio

    var defaultFilename: String {
        switch self {
        case .image: "memory.jpg"
        case .video: "memory.mp4"
        case .audio: "memory.m4a"
        }
    }

    var defaultMimeType: String {
        switch self {
        case .image: "image/jpeg"
        case .video: "video/mp4"
        case .audio: "audio/mp4"
        }
    }
}

enum MemoryMediaValidationError: LocalizedError, Equatable {
    case tooLarge
    case unsupportedType

    var errorDescription: String? {
        switch self {
        case .tooLarge:
            MemoryMedia.tooLargeMessage
        case .unsupportedType:
            MemoryMedia.typeMessage
        }
    }
}

enum MemoryMedia {
    /// Same ceiling as the `account-documents` bucket / web Memories composer.
    static let maxBytes = 50 * 1024 * 1024
    static let maxLabel = "50 MB"
    /// Multipart through Vercel is only safe for compressed photos.
    static let multipartMaxBytes = 4 * 1024 * 1024

    static let tooLargeMessage =
        "This file is over \(maxLabel). Memories accept photos, video, and audio up to \(maxLabel)."
    static let typeMessage =
        "Attach a photo, video (mp4/mov), or voice note (m4a, caf, mp3, wav)."

    static func mimeType(filename: String, fallback: String = "application/octet-stream") -> String {
        switch (filename as NSString).pathExtension.lowercased() {
        case "jpg", "jpeg": "image/jpeg"
        case "png": "image/png"
        case "webp": "image/webp"
        case "gif": "image/gif"
        case "heic": "image/heic"
        case "heif": "image/heif"
        case "mp4", "m4v": "video/mp4"
        case "mov": "video/quicktime"
        case "webm": "video/webm"
        case "m4a": "audio/mp4"
        case "caf": "audio/x-caf"
        case "mp3": "audio/mpeg"
        case "wav": "audio/wav"
        case "aac": "audio/aac"
        case "ogg": "audio/ogg"
        default: fallback
        }
    }

    static func kind(mimeType: String?, filename: String = "") -> MemoryMediaKind? {
        let mime = (mimeType ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let ext = (filename as NSString).pathExtension.lowercased()

        if mime.hasPrefix("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].contains(ext) {
            return .image
        }
        if mime.hasPrefix("video/") || ["mp4", "mov", "m4v", "webm"].contains(ext) {
            return .video
        }
        if mime.hasPrefix("audio/") || ["m4a", "caf", "mp3", "wav", "aac", "ogg", "webm"].contains(ext) {
            return .audio
        }
        return nil
    }

    static func validate(size: Int, mimeType: String?, filename: String) throws -> MemoryMediaKind {
        guard size >= 0, size <= maxBytes else {
            throw MemoryMediaValidationError.tooLarge
        }
        guard let kind = kind(mimeType: mimeType, filename: filename) else {
            throw MemoryMediaValidationError.unsupportedType
        }
        return kind
    }
}

struct MemoryPickedFile: Identifiable, Equatable {
    var id = UUID()
    var data: Data
    var filename: String
    var mimeType: String
    var kind: MemoryMediaKind
}
