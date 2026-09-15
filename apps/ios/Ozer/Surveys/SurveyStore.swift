import Foundation
import Observation

/// Cached remote surveys plus local creates that have not synced yet.
@MainActor
@Observable
final class SurveyStore {
    static let shared = SurveyStore()

    private(set) var surveys: [SurveyItem] = []

    private init() {
        surveys = Self.load()
    }

    func surveys(for workspace: String) -> [SurveyItem] {
        let key = workspace.trimmingCharacters(in: .whitespacesAndNewlines)
        return surveys
            .filter { ($0.workspace ?? "") == key }
            .sorted { ($0.updatedAt ?? $0.createdAt ?? "") > ($1.updatedAt ?? $1.createdAt ?? "") }
    }

    func survey(id: String) -> SurveyItem? {
        surveys.first { $0.id == id }
    }

    @discardableResult
    func saveLocal(
        workspace: String,
        title: String,
        surveyType: SurveyTypeOption,
        clientId: String?,
        clientName: String?
    ) -> SurveyItem {
        let now = OfflineNoteQueue.isoString(from: Date())
        let item = SurveyItem(
            id: UUID().uuidString,
            title: title,
            workspace: workspace,
            status: "draft",
            surveyType: surveyType.rawValue,
            surveyTypeLabel: surveyType.label,
            clientId: clientId,
            clientName: clientName,
            createdAt: now,
            updatedAt: now,
            isLocal: true
        )
        surveys.removeAll { $0.id == item.id }
        surveys.insert(item, at: 0)
        persist()
        return item
    }

    func replaceRemote(workspace: String, items: [SurveyItem]) {
        let key = workspace.trimmingCharacters(in: .whitespacesAndNewlines)
        let locals = surveys.filter { $0.isLocal && ($0.workspace ?? "") == key }
        let others = surveys.filter { ($0.workspace ?? "") != key }
        let remotes = items.map { item in
            var copy = item
            copy.workspace = key
            copy.isLocal = false
            return copy
        }
        surveys = remotes + locals + others
        persist()
    }

    func markRemote(localId: String, remote: SurveyItem) {
        surveys.removeAll { $0.id == localId || $0.id == remote.id }
        var copy = remote
        copy.isLocal = false
        surveys.insert(copy, at: 0)
        persist()
    }

    private func persist() {
        Self.write(surveys)
    }

    nonisolated private static var fileURL: URL {
        let folder = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("OzerSurveys", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        var mutable = folder
        try? mutable.setResourceValues(values)
        return folder.appendingPathComponent("surveys.json")
    }

    nonisolated private static func load() -> [SurveyItem] {
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        return (try? JSONDecoder().decode([SurveyItem].self, from: data)) ?? []
    }

    nonisolated private static func write(_ items: [SurveyItem]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        try? data.write(to: fileURL, options: .atomic)
    }
}

extension SurveyItem: Encodable {
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(workspace, forKey: .workspace)
        try container.encode(status, forKey: .status)
        try container.encode(surveyType, forKey: .surveyType)
        try container.encode(surveyTypeLabel, forKey: .surveyTypeLabel)
        try container.encodeIfPresent(clientId, forKey: .clientId)
        try container.encodeIfPresent(clientName, forKey: .clientName)
        try container.encode(sessionCount, forKey: .sessionCount)
        try container.encode(photoCount, forKey: .photoCount)
        try container.encodeIfPresent(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encode(isLocal, forKey: .isLocal)
    }
}
