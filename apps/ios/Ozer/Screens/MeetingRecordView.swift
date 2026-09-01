import SwiftUI

struct MeetingRecordView: View {
    var onFinished: (LocalMeeting?) async -> Void

    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var capture = MeetingCaptureSession()
    @State private var isStopping = false
    @State private var startError: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text(capture.isRecording ? capture.elapsedLabel : "0:00")
                    .font(.system(size: 48, weight: .semibold, design: .rounded))
                    .foregroundStyle(OzerPalette.plum)
                    .monospacedDigit()

                ScrollView {
                    Text(capture.liveTranscript.isEmpty ? "Live captions will land here." : capture.liveTranscript)
                        .font(.body)
                        .foregroundStyle(capture.liveTranscript.isEmpty ? OzerPalette.plumMuted : OzerPalette.plum)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }

                if let startError {
                    Text(startError)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await stopAndSave() }
                } label: {
                    Text(isStopping ? "Saving…" : "Stop")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .disabled(isStopping || !capture.isRecording)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Recording")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        capture.cancel()
                        dismiss()
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                    .disabled(isStopping)
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

    private func start() async {
        do {
            try await capture.start()
        } catch {
            startError = error.localizedDescription
        }
    }

    private func stopAndSave() async {
        isStopping = true
        defer { isStopping = false }
        do {
            let result = try await capture.stop()
            let workspace = session.workspaceQueryValue
            let fallback = Self.meetingTitle(on: Date())
            let title = SpeakerTurnSplitter.title(from: result.transcript, fallback: fallback)
            let body = result.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
            let meeting = MeetingStore.shared.save(
                workspace: workspace,
                title: title,
                transcript: body.isEmpty ? title : body,
                duration: result.duration,
                audioURL: result.audioURL
            )
            if !workspace.isEmpty, !meeting.transcript.isEmpty {
                _ = OfflineNoteQueue.shared.enqueue(
                    workspace: workspace,
                    title: meeting.title,
                    body: meeting.transcript,
                    tags: ["meeting"],
                    category: "meeting_transcript",
                    meetingId: meeting.id
                )
                await session.flushOfflineWork()
            }
            await onFinished(meeting)
            dismiss()
        } catch {
            startError = error.localizedDescription
        }
    }

    static func meetingTitle(on date: Date) -> String {
        "Meeting, \(Self.dayFormatter.string(from: date))"
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "d MMM yyyy"
        return formatter
    }()
}
