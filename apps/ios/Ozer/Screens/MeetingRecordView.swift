import SwiftUI

struct MeetingRecordView: View {
    var onFinished: (LocalMeeting?) async -> Void

    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var capture = MeetingCaptureSession()
    @State private var isStopping = false
    @State private var isPausing = false
    @State private var startError: String?
    @State private var selectedClientId: String?
    @State private var clients: [ClientItem] = []

    private let api = NativeAPIClient()

    private var showsClientPicker: Bool {
        session.selectedWorkspace?.showsClients == true
    }

    private var selectedClient: ClientItem? {
        guard let selectedClientId else { return nil }
        return clients.first { $0.id == selectedClientId }
    }

    private var controlsLocked: Bool {
        isStopping || isPausing || capture.isLabelling
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                VStack(spacing: 6) {
                    Text(capture.isRecording ? capture.elapsedLabel : "0:00")
                        .font(.system(size: 48, weight: .semibold, design: .rounded))
                        .foregroundStyle(OzerPalette.plum)
                        .monospacedDigit()
                    if capture.isPaused {
                        Text("Paused")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                }

                ScrollView {
                    SpeakerTranscriptView(
                        turns: capture.displayTurns,
                        emptyMessage: "Live captions will land here."
                    )
                    .padding(16)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                        .stroke(OzerPalette.border, lineWidth: 1)
                }

                if showsClientPicker {
                    clientPicker
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
                        Task { await stopAndSave() }
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
            .navigationTitle("Recording")
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
                await loadClients()
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

    private var clientPicker: some View {
        Menu {
            Button("No client") {
                selectedClientId = nil
            }
            ForEach(clients) { client in
                Button(client.displayName) {
                    selectedClientId = client.id
                }
            }
        } label: {
            HStack {
                Text(selectedClient?.displayName ?? "Link a client")
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
        }
        .accessibilityLabel("Client")
        .accessibilityValue(selectedClient?.displayName ?? "None")
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

    private func loadClients() async {
        guard showsClientPicker else { return }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let payload = try await api.clients(workspace: workspace, accessToken: token)
            clients = payload.items
        } catch let error as NativeAPIError where error == .unauthorized {
            await session.handleUnauthorized()
        } catch {
            // Picker stays empty; the meeting can still be saved without a client.
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
                audioURL: result.audioURL,
                turns: result.turns,
                clientId: selectedClient?.id,
                clientName: selectedClient?.displayName
            )
            if !workspace.isEmpty, !meeting.transcript.isEmpty {
                _ = OfflineNoteQueue.shared.enqueue(
                    workspace: workspace,
                    title: meeting.title,
                    body: meeting.transcript,
                    tags: ["meeting"],
                    category: "meeting_transcript",
                    meetingId: meeting.id,
                    clientId: meeting.clientId
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
