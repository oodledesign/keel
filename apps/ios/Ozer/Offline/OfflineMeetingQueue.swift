import Foundation
import Observation

struct PendingMeeting: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var workspace: String
    var title: String
    var content: String
    var clientId: String
    var meetingDate: String
    var source: String
    var durationSeconds: Int
    var localMeetingId: String
    var createdAt: String
}

/// Local meeting creates that POST `/api/native/v1/meetings` when the phone is online.
@MainActor
@Observable
final class OfflineMeetingQueue {
    static let shared = OfflineMeetingQueue()

    private static let fileName = "pending-meetings.json"

    private(set) var pending: [PendingMeeting] = []
    private(set) var lastFlushError: String?
    private var isFlushing = false

    private var fileURL: URL {
        Self.storageDirectory.appendingPathComponent(Self.fileName)
    }

    init() {
        pending = Self.load(from: fileURL)
    }

    func pending(for workspace: String) -> [PendingMeeting] {
        let key = workspace.trimmingCharacters(in: .whitespacesAndNewlines)
        return pending.filter { $0.workspace == key }
    }

    func enqueue(
        workspace: String,
        title: String,
        content: String,
        clientId: String,
        meetingDate: String,
        localMeetingId: String,
        durationSeconds: Int,
        source: String = "iphone"
    ) -> PendingMeeting {
        let item = PendingMeeting(
            id: UUID().uuidString,
            workspace: workspace,
            title: title,
            content: content,
            clientId: clientId,
            meetingDate: meetingDate,
            source: source,
            durationSeconds: durationSeconds,
            localMeetingId: localMeetingId,
            createdAt: OfflineNoteQueue.isoString(from: Date())
        )
        pending.insert(item, at: 0)
        lastFlushError = nil
        persist()
        return item
    }

    func remove(id: String) {
        pending.removeAll { $0.id == id }
        persist()
    }

    func flush(accessToken: String) async {
        guard !isFlushing, !pending.isEmpty else { return }
        isFlushing = true
        defer { isFlushing = false }

        let client = NativeAPIClient()
        let snapshot = pending
        var lastError: String?
        for meeting in snapshot {
            do {
                let created = try await client.createMeeting(
                    title: meeting.title,
                    content: meeting.content,
                    workspace: meeting.workspace,
                    clientId: meeting.clientId,
                    meetingDate: meeting.meetingDate,
                    source: meeting.source,
                    durationSeconds: meeting.durationSeconds,
                    accessToken: accessToken
                )
                remove(id: meeting.id)
                MeetingStore.shared.markSynced(id: meeting.localMeetingId, remoteNoteId: created.id)
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

    private func persist() {
        Self.write(pending, to: fileURL)
    }

    nonisolated private static var storageDirectory: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OzerOffline", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = folder
        try? mutable.setResourceValues(values)
        return folder
    }

    nonisolated private static func load(from url: URL) -> [PendingMeeting] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([PendingMeeting].self, from: data)) ?? []
    }

    nonisolated private static func write(_ meetings: [PendingMeeting], to url: URL) {
        guard let data = try? JSONEncoder().encode(meetings) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
