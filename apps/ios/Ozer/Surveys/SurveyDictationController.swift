import Foundation
import Observation

/// Per-section dictation state that survives section switches and app relaunches.
struct SurveyDictationTake: Codable, Equatable, Identifiable {
    var id: String
    var surveyId: String
    var ricsCode: String
    var sectionLabel: String
    var transcript: String
    var elapsed: TimeInterval
    var isPaused: Bool
    var updatedAt: String
}

/// Pure state machine for survey dictation across sections.
/// Recording audio stays in MeetingCaptureSession; this tracks which section owns it.
@MainActor
@Observable
final class SurveyDictationController {
    private(set) var activeSurveyId: String?
    private(set) var activeRicsCode: String?
    private(set) var activeSectionLabel: String?
    private(set) var takes: [SurveyDictationTake] = []

    var hasActiveOrPaused: Bool {
        !takes.isEmpty || activeRicsCode != nil
    }

    var statusPillLabel: String? {
        if let active = activeTake, !active.isPaused {
            return "Recording · \(active.sectionLabel) · \(Self.formatElapsed(active.elapsed))"
        }
        let paused = takes.filter(\.isPaused)
        if paused.isEmpty { return nil }
        if paused.count == 1, let only = paused.first {
            return "Paused · \(only.sectionLabel)"
        }
        return "Paused · \(paused.count) notes"
    }

    var activeTake: SurveyDictationTake? {
        guard let surveyId = activeSurveyId, let code = activeRicsCode else { return nil }
        return takes.first { $0.surveyId == surveyId && $0.ricsCode == code }
    }

    func begin(surveyId: String, ricsCode: String, sectionLabel: String) {
        activeSurveyId = surveyId
        activeRicsCode = ricsCode
        activeSectionLabel = sectionLabel
        upsert(
            SurveyDictationTake(
                id: "\(surveyId):\(ricsCode)",
                surveyId: surveyId,
                ricsCode: ricsCode,
                sectionLabel: sectionLabel,
                transcript: activeTake?.transcript ?? "",
                elapsed: activeTake?.elapsed ?? 0,
                isPaused: false,
                updatedAt: ISO8601DateFormatter().string(from: Date())
            )
        )
        persist()
    }

    func updateLive(transcript: String, elapsed: TimeInterval) {
        guard var take = activeTake else { return }
        take.transcript = transcript
        take.elapsed = elapsed
        take.isPaused = false
        take.updatedAt = ISO8601DateFormatter().string(from: Date())
        upsert(take)
    }

    /// Pause the current section so another can be recorded.
    func pauseCurrent() {
        guard var take = activeTake else { return }
        take.isPaused = true
        take.updatedAt = ISO8601DateFormatter().string(from: Date())
        upsert(take)
        persist()
    }

    func resume(ricsCode: String) {
        guard let surveyId = activeSurveyId,
              var take = takes.first(where: { $0.surveyId == surveyId && $0.ricsCode == ricsCode })
        else { return }
        take.isPaused = false
        take.updatedAt = ISO8601DateFormatter().string(from: Date())
        activeRicsCode = ricsCode
        activeSectionLabel = take.sectionLabel
        upsert(take)
        persist()
    }

    /// Switch section while recording: pause the current take, activate the next.
    func switchSection(to ricsCode: String, sectionLabel: String) {
        pauseCurrent()
        guard let surveyId = activeSurveyId else { return }
        begin(surveyId: surveyId, ricsCode: ricsCode, sectionLabel: sectionLabel)
    }

    func finishCurrent() -> SurveyDictationTake? {
        guard let take = activeTake else { return nil }
        takes.removeAll { $0.id == take.id }
        if takes.isEmpty {
            activeSurveyId = nil
            activeRicsCode = nil
            activeSectionLabel = nil
        } else if let next = takes.first(where: { !$0.isPaused }) ?? takes.first {
            activeRicsCode = next.ricsCode
            activeSectionLabel = next.sectionLabel
        }
        persist()
        return take
    }

    func discardAll() {
        takes = []
        activeSurveyId = nil
        activeRicsCode = nil
        activeSectionLabel = nil
        persist()
    }

    func restoreFromDisk() {
        takes = Self.load()
        if let active = takes.first(where: { !$0.isPaused }) ?? takes.first {
            activeSurveyId = active.surveyId
            activeRicsCode = active.ricsCode
            activeSectionLabel = active.sectionLabel
        }
    }

    private func upsert(_ take: SurveyDictationTake) {
        if let index = takes.firstIndex(where: { $0.id == take.id }) {
            takes[index] = take
        } else {
            takes.append(take)
        }
    }

    private func persist() {
        Self.write(takes)
    }

    static func formatElapsed(_ value: TimeInterval) -> String {
        let total = max(0, Int(value.rounded()))
        let minutes = total / 60
        let seconds = total % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    private static var storeURL: URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        let dir = root.appendingPathComponent("OzerSurveyDictation", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("paused-takes.json")
    }

    private static func load() -> [SurveyDictationTake] {
        guard let data = try? Data(contentsOf: storeURL) else { return [] }
        return (try? JSONDecoder().decode([SurveyDictationTake].self, from: data)) ?? []
    }

    private static func write(_ takes: [SurveyDictationTake]) {
        do {
            let data = try JSONEncoder().encode(takes)
            try data.write(to: storeURL, options: .atomic)
        } catch {
            #if DEBUG
            print("SurveyDictationController: failed to persist paused takes — \(error)")
            #endif
        }
    }
}
