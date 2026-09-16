import Foundation
import Observation

struct PendingSurveyCreate: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var workspace: String
    var title: String
    var surveyType: String
    var clientId: String?
    var clientName: String?
    var createdAt: String
}

struct PendingSurveySession: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var workspace: String
    var surveyId: String
    var isLocalSurvey: Bool
    var title: String
    var content: String
    var durationSeconds: Int
    var meetingDate: String
    var audioFileName: String?
    var createdAt: String
    var ricsCode: String?
}

struct PendingSurveyPhoto: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var workspace: String
    var surveyId: String
    var isLocalSurvey: Bool
    var title: String
    var fileName: String
    var mimeType: String
    var createdAt: String
    var ricsCode: String?
}

/// Local survey creates, recordings, and photos. Flush never drops an item until the server ACKs.
@MainActor
@Observable
final class OfflineSurveyQueue {
    static let shared = OfflineSurveyQueue()

    private(set) var pendingCreates: [PendingSurveyCreate] = []
    private(set) var pendingSessions: [PendingSurveySession] = []
    private(set) var pendingPhotos: [PendingSurveyPhoto] = []
    private(set) var lastFlushError: String?
    private var isFlushing = false

    var pendingCount: Int {
        pendingCreates.count + pendingSessions.count + pendingPhotos.count
    }

    private init() {
        pendingCreates = Self.load(from: Self.createsURL, as: [PendingSurveyCreate].self)
        pendingSessions = Self.load(from: Self.sessionsURL, as: [PendingSurveySession].self)
        pendingPhotos = Self.load(from: Self.photosURL, as: [PendingSurveyPhoto].self)
    }

    func pendingCount(for workspace: String) -> Int {
        let key = workspace.trimmingCharacters(in: .whitespacesAndNewlines)
        return pendingCreates.filter { $0.workspace == key }.count
            + pendingSessions.filter { $0.workspace == key }.count
            + pendingPhotos.filter { $0.workspace == key }.count
    }

    func sessions(forSurvey surveyId: String, workspace: String) -> [PendingSurveySession] {
        pendingSessions.filter { $0.surveyId == surveyId && $0.workspace == workspace }
    }

    func photos(forSurvey surveyId: String, workspace: String) -> [PendingSurveyPhoto] {
        pendingPhotos.filter { $0.surveyId == surveyId && $0.workspace == workspace }
    }

    func sessions(forSurvey surveyId: String, workspace: String, ricsCode: String) -> [PendingSurveySession] {
        sessions(forSurvey: surveyId, workspace: workspace).filter {
            matchesSection($0.ricsCode, ricsCode)
        }
    }

    func photos(forSurvey surveyId: String, workspace: String, ricsCode: String) -> [PendingSurveyPhoto] {
        photos(forSurvey: surveyId, workspace: workspace).filter {
            matchesSection($0.ricsCode, ricsCode)
        }
    }

    private func matchesSection(_ stored: String?, _ ricsCode: String) -> Bool {
        guard let stored, !stored.isEmpty else { return false }
        if stored.caseInsensitiveCompare(ricsCode) == .orderedSame { return true }
        let left = SurveySectionCatalogue.section(ricsCodeOrKey: stored)
        let right = SurveySectionCatalogue.section(ricsCodeOrKey: ricsCode)
        return left?.ricsCode == right?.ricsCode && left != nil
    }

    func enqueueCreate(
        id: String = UUID().uuidString,
        workspace: String,
        title: String,
        surveyType: String,
        clientId: String?,
        clientName: String?
    ) -> PendingSurveyCreate {
        let item = PendingSurveyCreate(
            id: id,
            workspace: workspace,
            title: title,
            surveyType: surveyType,
            clientId: clientId,
            clientName: clientName,
            createdAt: OfflineNoteQueue.isoString(from: Date())
        )
        pendingCreates.insert(item, at: 0)
        lastFlushError = nil
        persistCreates()
        return item
    }

    func enqueueSession(
        workspace: String,
        surveyId: String,
        isLocalSurvey: Bool,
        title: String,
        content: String,
        durationSeconds: Int,
        meetingDate: String,
        audioURL: URL?,
        ricsCode: String? = nil
    ) -> PendingSurveySession {
        var fileName = audioURL?.lastPathComponent
        if let audioURL {
            fileName = Self.persistQueuedFile(
                from: audioURL,
                directory: Self.audioDirectory,
                fallbackExtension: "m4a"
            )
        }
        let item = PendingSurveySession(
            id: UUID().uuidString,
            workspace: workspace,
            surveyId: surveyId,
            isLocalSurvey: isLocalSurvey,
            title: title,
            content: content,
            durationSeconds: durationSeconds,
            meetingDate: meetingDate,
            audioFileName: fileName,
            createdAt: OfflineNoteQueue.isoString(from: Date()),
            ricsCode: ricsCode
        )
        pendingSessions.insert(item, at: 0)
        lastFlushError = nil
        persistSessions()
        return item
    }

    func enqueuePhoto(
        workspace: String,
        surveyId: String,
        isLocalSurvey: Bool,
        title: String,
        imageData: Data,
        mimeType: String = "image/jpeg",
        ricsCode: String? = nil
    ) -> PendingSurveyPhoto {
        let fileName = "\(UUID().uuidString).jpg"
        let url = Self.photoDirectory.appendingPathComponent(fileName)
        try? imageData.write(to: url, options: .atomic)
        let item = PendingSurveyPhoto(
            id: UUID().uuidString,
            workspace: workspace,
            surveyId: surveyId,
            isLocalSurvey: isLocalSurvey,
            title: title,
            fileName: fileName,
            mimeType: mimeType,
            createdAt: OfflineNoteQueue.isoString(from: Date()),
            ricsCode: ricsCode
        )
        pendingPhotos.insert(item, at: 0)
        lastFlushError = nil
        persistPhotos()
        return item
    }

    func audioURL(for session: PendingSurveySession) -> URL? {
        guard let name = session.audioFileName else { return nil }
        let url = Self.audioDirectory.appendingPathComponent(name)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    func photoURL(for photo: PendingSurveyPhoto) -> URL? {
        let url = Self.photoDirectory.appendingPathComponent(photo.fileName)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    func flush(accessToken: String) async {
        guard !isFlushing, pendingCount > 0 else { return }
        isFlushing = true
        defer { isFlushing = false }

        let client = NativeAPIClient()
        var lastError: String?

        for create in pendingCreates {
            do {
                let remote = try await client.createSurvey(
                    title: create.title,
                    workspace: create.workspace,
                    surveyType: create.surveyType,
                    clientId: create.clientId,
                    accessToken: accessToken
                )
                remapSurveyId(from: create.id, to: remote.id, workspace: create.workspace)
                pendingCreates.removeAll { $0.id == create.id }
                persistCreates()
                SurveyStore.shared.markRemote(localId: create.id, remote: remote)
            } catch let error as NativeAPIError where error == .unauthorized {
                lastFlushError = error.localizedDescription
                return
            } catch {
                if error.isTaskCancellation { return }
                lastError = error.localizedDescription
            }
        }

        for session in pendingSessions.filter({ !$0.isLocalSurvey }) {
            do {
                var audioData: Data?
                var filename = "recording.m4a"
                if let url = audioURL(for: session) {
                    audioData = try? Data(contentsOf: url)
                    filename = url.lastPathComponent
                }
                _ = try await client.uploadSurveySession(
                    surveyId: session.surveyId,
                    workspace: session.workspace,
                    title: session.title,
                    content: session.content,
                    durationSeconds: session.durationSeconds,
                    meetingDate: session.meetingDate,
                    audioData: audioData,
                    filename: filename,
                    ricsCode: session.ricsCode,
                    accessToken: accessToken
                )
                if let url = audioURL(for: session) {
                    try? FileManager.default.removeItem(at: url)
                }
                pendingSessions.removeAll { $0.id == session.id }
                persistSessions()
            } catch let error as NativeAPIError where error == .unauthorized {
                lastFlushError = error.localizedDescription
                return
            } catch {
                if error.isTaskCancellation { return }
                lastError = error.localizedDescription
            }
        }

        for photo in pendingPhotos.filter({ !$0.isLocalSurvey }) {
            do {
                guard let url = photoURL(for: photo),
                      let data = try? Data(contentsOf: url) else {
                    lastError = "A queued photo is missing on disk."
                    continue
                }
                _ = try await client.uploadSurveyPhoto(
                    surveyId: photo.surveyId,
                    workspace: photo.workspace,
                    imageData: data,
                    filename: photo.fileName,
                    mimeType: photo.mimeType,
                    title: photo.title,
                    ricsCode: photo.ricsCode,
                    accessToken: accessToken
                )
                try? FileManager.default.removeItem(at: url)
                pendingPhotos.removeAll { $0.id == photo.id }
                persistPhotos()
            } catch let error as NativeAPIError where error == .unauthorized {
                lastFlushError = error.localizedDescription
                return
            } catch {
                if error.isTaskCancellation { return }
                lastError = error.localizedDescription
            }
        }

        lastFlushError = lastError
    }

    private func remapSurveyId(from localId: String, to remoteId: String, workspace: String) {
        for index in pendingSessions.indices where pendingSessions[index].surveyId == localId
            && pendingSessions[index].workspace == workspace {
            pendingSessions[index].surveyId = remoteId
            pendingSessions[index].isLocalSurvey = false
        }
        for index in pendingPhotos.indices where pendingPhotos[index].surveyId == localId
            && pendingPhotos[index].workspace == workspace {
            pendingPhotos[index].surveyId = remoteId
            pendingPhotos[index].isLocalSurvey = false
        }
        persistSessions()
        persistPhotos()
    }

    private func persistCreates() {
        Self.write(pendingCreates, to: Self.createsURL)
    }

    private func persistSessions() {
        Self.write(pendingSessions, to: Self.sessionsURL)
    }

    private func persistPhotos() {
        Self.write(pendingPhotos, to: Self.photosURL)
    }

    nonisolated private static var storageDirectory: URL {
        excludedSupportFolder("OzerSurveyQueue")
    }

    nonisolated static var audioDirectory: URL {
        excludedSupportFolder("OzerSurveyQueue/audio")
    }

    nonisolated static var photoDirectory: URL {
        excludedSupportFolder("OzerSurveyQueue/photos")
    }

    nonisolated private static var createsURL: URL {
        storageDirectory.appendingPathComponent("pending-survey-creates.json")
    }

    nonisolated private static var sessionsURL: URL {
        storageDirectory.appendingPathComponent("pending-survey-sessions.json")
    }

    nonisolated private static var photosURL: URL {
        storageDirectory.appendingPathComponent("pending-survey-photos.json")
    }

    nonisolated private static func persistQueuedFile(
        from source: URL,
        directory: URL,
        fallbackExtension: String
    ) -> String {
        let preferred = directory.appendingPathComponent(source.lastPathComponent)
        if source.standardizedFileURL == preferred.standardizedFileURL {
            return preferred.lastPathComponent
        }
        if copyItemReplacing(from: source, to: preferred) {
            return preferred.lastPathComponent
        }
        let unique = directory.appendingPathComponent(
            "\(UUID().uuidString).\(source.pathExtension.isEmpty ? fallbackExtension : source.pathExtension)"
        )
        if copyItemReplacing(from: source, to: unique) {
            return unique.lastPathComponent
        }
        return source.lastPathComponent
    }

    nonisolated private static func copyItemReplacing(from source: URL, to destination: URL) -> Bool {
        do {
            if FileManager.default.fileExists(atPath: destination.path) {
                try FileManager.default.removeItem(at: destination)
            }
            try FileManager.default.copyItem(at: source, to: destination)
            return true
        } catch {
            return false
        }
    }

    nonisolated private static func excludedSupportFolder(_ name: String) -> URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(name, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = folder
        try? mutable.setResourceValues(values)
        return folder
    }

    nonisolated private static func load<T: Decodable>(from url: URL, as type: T.Type) -> T {
        guard let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(type, from: data) else {
            if T.self == [PendingSurveyCreate].self {
                return [] as! T
            }
            if T.self == [PendingSurveySession].self {
                return [] as! T
            }
            if T.self == [PendingSurveyPhoto].self {
                return [] as! T
            }
            fatalError("Unsupported queue type")
        }
        return decoded
    }

    nonisolated private static func write<T: Encodable>(_ value: T, to url: URL) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
