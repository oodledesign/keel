import Foundation

/// Stale-while-revalidate list heads for Tasks and Notes.
/// Documents JSON so a rebuild without delete still has the last 10–20 rows.
enum WorkspaceListCache {
    static let maxItems = 20

    private static let folderName = "OzerListCache"

    static func loadTasks(userId: String, workspaceId: String) -> [TaskItem] {
        guard let url = fileURL(userId: userId, workspaceId: workspaceId, kind: "tasks"),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(TasksPayload.self, from: data)
        else {
            return []
        }
        return Array(payload.items.prefix(maxItems))
    }

    static func saveTasks(userId: String, workspaceId: String, items: [TaskItem]) {
        guard let url = fileURL(userId: userId, workspaceId: workspaceId, kind: "tasks") else {
            return
        }
        let payload = TasksPayload(items: Array(items.prefix(maxItems)))
        guard let data = try? JSONEncoder().encode(payload) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func loadNotes(userId: String, workspaceId: String) -> NotesPayload {
        guard let url = fileURL(userId: userId, workspaceId: workspaceId, kind: "notes"),
              let data = try? Data(contentsOf: url),
              let payload = try? JSONDecoder().decode(NotesPayload.self, from: data)
        else {
            return .empty
        }
        return NotesPayload(
            items: Array(payload.items.prefix(maxItems)),
            categories: payload.categories
        )
    }

    static func saveNotes(userId: String, workspaceId: String, payload: NotesPayload) {
        guard let url = fileURL(userId: userId, workspaceId: workspaceId, kind: "notes") else {
            return
        }
        let snapshot = NotesPayload(
            items: Array(payload.items.prefix(maxItems)),
            categories: payload.categories
        )
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static func upsertNote(
        userId: String,
        workspaceId: String,
        note: NoteItem,
        categories: [NoteCategory]
    ) {
        var items = loadNotes(userId: userId, workspaceId: workspaceId).items
            .filter { $0.id != note.id }
        items.insert(note, at: 0)
        saveNotes(
            userId: userId,
            workspaceId: workspaceId,
            payload: NotesPayload(items: items, categories: categories)
        )
    }

    static func upsertTask(userId: String, workspaceId: String, task: TaskItem) {
        var items = loadTasks(userId: userId, workspaceId: workspaceId)
            .filter { $0.id != task.id }
        items.insert(task, at: 0)
        saveTasks(userId: userId, workspaceId: workspaceId, items: items)
    }

    private static func fileURL(userId: String, workspaceId: String, kind: String) -> URL? {
        let user = sanitize(userId)
        let workspace = sanitize(workspaceId)
        guard !user.isEmpty, !workspace.isEmpty else { return nil }

        let folder = documentsDirectory
            .appendingPathComponent(folderName, isDirectory: true)
            .appendingPathComponent(user, isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("\(kind)-\(workspace).json")
    }

    private static var documentsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private static func sanitize(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let scalars = trimmed.unicodeScalars.map { scalar -> Character in
            CharacterSet.alphanumerics.contains(scalar) ? Character(scalar) : "-"
        }
        return String(scalars)
    }
}
