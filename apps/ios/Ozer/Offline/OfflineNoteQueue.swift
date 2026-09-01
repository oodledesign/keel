import Foundation
import Observation

struct PendingNote: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var workspace: String
    var title: String
    var body: String
    var tags: [String]
    var category: String?
    var createdAt: String
    var meetingId: String?

    func asNoteItem() -> NoteItem {
        NoteItem(
            id: id,
            title: title,
            body: body,
            workspace: workspace,
            createdAt: createdAt,
            updatedAt: createdAt,
            category: category,
            tags: tags,
            isPendingSync: true
        )
    }
}

/// Local note creates that POST when the phone is back online.
@MainActor
@Observable
final class OfflineNoteQueue {
    static let shared = OfflineNoteQueue()

    private static let fileName = "pending-notes.json"

    private(set) var pending: [PendingNote] = []
    private var isFlushing = false

    private var fileURL: URL {
        Self.storageDirectory.appendingPathComponent(Self.fileName)
    }

    init() {
        pending = Self.load(from: fileURL)
    }

    func pending(for workspace: String) -> [PendingNote] {
        let key = workspace.trimmingCharacters(in: .whitespacesAndNewlines)
        return pending.filter { $0.workspace == key }
    }

    func enqueue(
        workspace: String,
        title: String,
        body: String,
        tags: [String] = [],
        category: String? = nil,
        meetingId: String? = nil
    ) -> PendingNote {
        let note = PendingNote(
            id: UUID().uuidString,
            workspace: workspace,
            title: title,
            body: body,
            tags: tags,
            category: category,
            createdAt: Self.isoString(from: Date()),
            meetingId: meetingId
        )
        pending.insert(note, at: 0)
        persist()
        return note
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
        for note in snapshot {
            do {
                let created = try await client.createNote(
                    title: note.title,
                    body: note.body,
                    workspace: note.workspace,
                    tags: note.tags,
                    category: note.category,
                    accessToken: accessToken
                )
                remove(id: note.id)
                if let meetingId = note.meetingId {
                    MeetingStore.shared.markSynced(id: meetingId, remoteNoteId: created.id)
                }
            } catch let error as NativeAPIError where error == .unauthorized {
                return
            } catch {
                if error.isTaskCancellation { return }
                continue
            }
        }
    }

    private func persist() {
        Self.write(pending, to: fileURL)
    }

    static func isoString(from date: Date) -> String {
        Self.isoFractional.string(from: date)
    }

    private static var storageDirectory: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OzerOffline", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = folder
        try? mutable.setResourceValues(values)
        return folder
    }

    private static func load(from url: URL) -> [PendingNote] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([PendingNote].self, from: data)) ?? []
    }

    private static func write(_ notes: [PendingNote], to url: URL) {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
