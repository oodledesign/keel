import Foundation
import Observation

struct LocalMeeting: Codable, Identifiable, Equatable, Hashable {
    var id: String
    var workspace: String
    var title: String
    var transcript: String
    var createdAt: String
    var durationSeconds: Int
    var audioFileName: String?
    var remoteNoteId: String?

    var isWaitingToSync: Bool {
        remoteNoteId == nil
    }

    var audioURL: URL? {
        guard let audioFileName else { return nil }
        let url = MeetingStore.directory.appendingPathComponent(audioFileName)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    var durationLabel: String {
        MeetingCaptureSession.formatElapsed(TimeInterval(durationSeconds))
    }
}

@MainActor
@Observable
final class MeetingStore {
    static let shared = MeetingStore()

    private static let fileName = "meetings.json"

    private(set) var meetings: [LocalMeeting] = []

    init() {
        meetings = Self.load()
    }

    func meetings(for workspace: String) -> [LocalMeeting] {
        let key = workspace.trimmingCharacters(in: .whitespacesAndNewlines)
        return meetings
            .filter { $0.workspace == key }
            .sorted { $0.createdAt > $1.createdAt }
    }

    func meeting(id: String) -> LocalMeeting? {
        meetings.first { $0.id == id }
    }

    @discardableResult
    func save(
        workspace: String,
        title: String,
        transcript: String,
        duration: TimeInterval,
        audioURL: URL?
    ) -> LocalMeeting {
        let id = audioURL?.deletingPathExtension().lastPathComponent ?? UUID().uuidString
        var fileName: String?
        if let audioURL {
            fileName = audioURL.lastPathComponent
        }
        let meeting = LocalMeeting(
            id: id,
            workspace: workspace,
            title: title,
            transcript: transcript,
            createdAt: OfflineNoteQueue.isoString(from: Date()),
            durationSeconds: max(0, Int(duration.rounded())),
            audioFileName: fileName,
            remoteNoteId: nil
        )
        meetings.removeAll { $0.id == id }
        meetings.insert(meeting, at: 0)
        persist()
        return meeting
    }

    func markSynced(id: String, remoteNoteId: String) {
        guard let index = meetings.firstIndex(where: { $0.id == id }) else { return }
        meetings[index].remoteNoteId = remoteNoteId
        persist()
    }

    func delete(id: String) {
        if let meeting = meetings.first(where: { $0.id == id }),
           let url = meeting.audioURL {
            try? FileManager.default.removeItem(at: url)
        }
        meetings.removeAll { $0.id == id }
        persist()
    }

    static func audioURL(for id: UUID) -> URL {
        Self.directory.appendingPathComponent("\(id.uuidString).m4a")
    }

    static var directory: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OzerMeetings", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = folder
        try? mutable.setResourceValues(values)
        return folder
    }

    private func persist() {
        Self.write(meetings)
    }

    private static func load() -> [LocalMeeting] {
        let url = Self.directory.appendingPathComponent(Self.fileName)
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([LocalMeeting].self, from: data)) ?? []
    }

    private static func write(_ meetings: [LocalMeeting]) {
        let url = Self.directory.appendingPathComponent(Self.fileName)
        guard let data = try? JSONEncoder().encode(meetings) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
