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
    var turns: [SpeakerTurn]
    var clientId: String?
    var clientName: String?
    var syncTarget: String?

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

    var displayTurns: [SpeakerTurn] {
        if !turns.isEmpty { return turns }
        return SpeakerTurnSplitter.parseTurns(from: transcript)
    }

    enum CodingKeys: String, CodingKey {
        case id, workspace, title, transcript, createdAt, durationSeconds
        case audioFileName, remoteNoteId, turns, clientId, clientName, syncTarget
    }

    init(
        id: String,
        workspace: String,
        title: String,
        transcript: String,
        createdAt: String,
        durationSeconds: Int,
        audioFileName: String?,
        remoteNoteId: String?,
        turns: [SpeakerTurn] = [],
        clientId: String? = nil,
        clientName: String? = nil,
        syncTarget: String? = nil
    ) {
        self.id = id
        self.workspace = workspace
        self.title = title
        self.transcript = transcript
        self.createdAt = createdAt
        self.durationSeconds = durationSeconds
        self.audioFileName = audioFileName
        self.remoteNoteId = remoteNoteId
        self.turns = turns
        self.clientId = clientId
        self.clientName = clientName
        self.syncTarget = syncTarget
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        workspace = try container.decode(String.self, forKey: .workspace)
        title = try container.decode(String.self, forKey: .title)
        transcript = try container.decode(String.self, forKey: .transcript)
        createdAt = try container.decode(String.self, forKey: .createdAt)
        durationSeconds = try container.decode(Int.self, forKey: .durationSeconds)
        audioFileName = try container.decodeIfPresent(String.self, forKey: .audioFileName)
        remoteNoteId = try container.decodeIfPresent(String.self, forKey: .remoteNoteId)
        turns = try container.decodeIfPresent([SpeakerTurn].self, forKey: .turns) ?? []
        clientId = try container.decodeIfPresent(String.self, forKey: .clientId)
        clientName = try container.decodeIfPresent(String.self, forKey: .clientName)
        syncTarget = try container.decodeIfPresent(String.self, forKey: .syncTarget)
    }
}

@MainActor
@Observable
final class MeetingStore {
    static let shared = MeetingStore()

    nonisolated private static let fileName = "meetings.json"

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
        audioURL: URL?,
        turns: [SpeakerTurn] = [],
        clientId: String? = nil,
        clientName: String? = nil,
        syncTarget: String? = nil
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
            remoteNoteId: nil,
            turns: turns,
            clientId: clientId,
            clientName: clientName,
            syncTarget: syncTarget
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

    nonisolated static func audioURL(for id: UUID) -> URL {
        Self.directory.appendingPathComponent("\(id.uuidString).m4a")
    }

    nonisolated static var directory: URL {
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

    nonisolated private static func load() -> [LocalMeeting] {
        let url = Self.directory.appendingPathComponent(Self.fileName)
        guard let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder().decode([LocalMeeting].self, from: data)) ?? []
    }

    nonisolated private static func write(_ meetings: [LocalMeeting]) {
        let url = Self.directory.appendingPathComponent(Self.fileName)
        guard let data = try? JSONEncoder().encode(meetings) else { return }
        try? data.write(to: url, options: .atomic)
    }
}
