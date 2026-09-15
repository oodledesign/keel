import SwiftUI

struct SurveyRecordView: View {
    var survey: SurveyItem
    var onFinished: () async -> Void

    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var capture = MeetingCaptureSession()
    @State private var isStopping = false
    @State private var isPausing = false
    @State private var startError: String?
    @State private var network = NetworkPathMonitor.shared

    private var controlsLocked: Bool {
        isStopping || isPausing || capture.isLabelling
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(capture.isPaused ? OzerPalette.plumSoft : OzerPalette.coral)
                            .frame(width: 10, height: 10)
                        Text(capture.isRecording ? capture.elapsedLabel : "0:00")
                            .font(.system(size: 48, weight: .semibold, design: .rounded))
                            .foregroundStyle(OzerPalette.plum)
                            .monospacedDigit()
                    }
                    Text(survey.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(OzerPalette.plum)
                    Text(network.isOnline ? "Online · will upload when you stop" : "Offline · queued on this iPhone")
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumMuted)
                    if capture.isPaused {
                        Text("Paused")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                }

                ScrollView {
                    SpeakerTranscriptView(
                        turns: capture.displayTurns,
                        emptyMessage: "Live captions will land here. The audio is saved even if captions miss a word."
                    )
                    .padding(16)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }

                if let status = capture.statusMessage {
                    Text(status)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .multilineTextAlignment(.center)
                }

                if let progress = capture.modelProgress {
                    ProgressView(value: progress)
                        .tint(OzerPalette.coral)
                }

                if let banner = startError ?? capture.lastError {
                    Text(banner)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .multilineTextAlignment(.center)
                }

                HStack(spacing: 12) {
                    Button {
                        Task { await togglePause() }
                    } label: {
                        Text(pauseResumeTitle)
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(OzerSecondaryButtonStyle())
                    .disabled(controlsLocked || !capture.isRecording)

                    Button {
                        Task { await stopRecording() }
                    } label: {
                        Text(isStopping ? "Saving…" : "Stop")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(OzerPrimaryButtonStyle())
                    .disabled(controlsLocked || !capture.isRecording)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Survey recording")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        capture.cancel()
                        dismiss()
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                    .disabled(controlsLocked)
                }
            }
            .task {
                await start()
            }
            .onDisappear {
                if capture.isRecording {
                    capture.cancel()
                }
            }
        }
    }

    private var pauseResumeTitle: String {
        if isPausing || (capture.isLabelling && capture.isPaused) {
            return "Pausing…"
        }
        return capture.isPaused ? "Resume" : "Pause"
    }

    private func start() async {
        do {
            try await capture.start()
        } catch is CancellationError {
            return
        } catch {
            startError = error.localizedDescription
        }
    }

    private func togglePause() async {
        if capture.isPaused {
            do {
                try await capture.resume()
            } catch {
                startError = error.localizedDescription
            }
            return
        }
        isPausing = true
        defer { isPausing = false }
        await capture.pause()
    }

    private func stopRecording() async {
        isStopping = true
        defer { isStopping = false }
        do {
            let result = try await capture.stop()
            let workspace = session.workspaceQueryValue
            let fallback = SurveyDisplay.sessionTitle(from: "", on: Date())
            let title = SurveyDisplay.sessionTitle(from: result.transcript, on: Date(), fallback: fallback)
            let body = result.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            _ = OfflineSurveyQueue.shared.enqueueSession(
                workspace: workspace,
                surveyId: survey.id,
                isLocalSurvey: survey.isLocal,
                title: title,
                content: body,
                durationSeconds: max(0, Int(result.duration.rounded())),
                meetingDate: TaskItem.dueString(from: Date()),
                audioURL: result.audioURL
            )
            await session.flushOfflineWork()
            await onFinished()
            dismiss()
        } catch {
            startError = error.localizedDescription
        }
    }
}
