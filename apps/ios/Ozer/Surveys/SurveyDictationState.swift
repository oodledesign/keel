import Foundation

/// Pure helpers for survey dictation across sections (unit-testable).
enum SurveyDictationState {
    struct Take: Equatable {
        var surveyId: String
        var ricsCode: String
        var sectionLabel: String
        var transcript: String
        var elapsed: TimeInterval
        var isPaused: Bool
    }

    static func switchSection(
        takes: [Take],
        from currentCode: String?,
        to nextCode: String,
        nextLabel: String,
        surveyId: String,
        liveTranscript: String,
        liveElapsed: TimeInterval
    ) -> (takes: [Take], activeCode: String) {
        var next = takes
        if let currentCode {
            if let index = next.firstIndex(where: {
                $0.surveyId == surveyId && $0.ricsCode == currentCode
            }) {
                next[index].transcript = liveTranscript
                next[index].elapsed = liveElapsed
                next[index].isPaused = true
            } else {
                next.append(
                    Take(
                        surveyId: surveyId,
                        ricsCode: currentCode,
                        sectionLabel: next.first(where: { $0.ricsCode == currentCode })?.sectionLabel
                            ?? currentCode,
                        transcript: liveTranscript,
                        elapsed: liveElapsed,
                        isPaused: true
                    )
                )
            }
        }

        if let index = next.firstIndex(where: {
            $0.surveyId == surveyId && $0.ricsCode == nextCode
        }) {
            next[index].isPaused = false
            next[index].sectionLabel = nextLabel
        } else {
            next.append(
                Take(
                    surveyId: surveyId,
                    ricsCode: nextCode,
                    sectionLabel: nextLabel,
                    transcript: "",
                    elapsed: 0,
                    isPaused: false
                )
            )
        }
        return (next, nextCode)
    }

    static func statusPill(
        takes: [Take],
        activeCode: String?,
        isRecording: Bool,
        elapsed: TimeInterval
    ) -> String? {
        if isRecording,
           let code = activeCode,
           let take = takes.first(where: { $0.ricsCode == code && !$0.isPaused })
        {
            return "Recording · \(take.sectionLabel) · \(formatElapsed(elapsed))"
        }
        let paused = takes.filter(\.isPaused)
        if paused.isEmpty { return nil }
        if paused.count == 1, let only = paused.first {
            return "Paused · \(only.sectionLabel)"
        }
        return "Paused · \(paused.count) notes"
    }

    static func formatElapsed(_ value: TimeInterval) -> String {
        let total = max(0, Int(value.rounded()))
        return String(format: "%02d:%02d", total / 60, total % 60)
    }
}
