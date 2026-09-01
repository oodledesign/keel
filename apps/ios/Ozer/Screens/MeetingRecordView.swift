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
    @State private var isLoadingClients = false
    @State private var pendingResult: MeetingCaptureResult?
    @State private var showSaveSheet = false
    @State private var destination: CaptureSaveDestination = .note

    private let api = NativeAPIClient()

    private var workspace: NativeWorkspace? {
        session.selectedWorkspace
    }

    private var allowsMeetingDestination: Bool {
        workspace?.allowsMeetingDestination == true
    }

    private var showsClientPicker: Bool {
        workspace?.showsClients == true
    }

    private var selectedClient: ClientItem? {
        guard let selectedClientId else { return nil }
        return clients.first { $0.id == selectedClientId }
    }

    private var meetingNeedsClient: Bool {
        destination == .meeting
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
                destination = workspace?.defaultCaptureDestination ?? .note
                await start()
                await loadClients()
            }
            .onDisappear {
                if capture.isRecording {
                    capture.cancel()
                }
            }
            .sheet(isPresented: $showSaveSheet) {
                saveSheet
                    .interactiveDismissDisabled()
            }
        }
    }

    private var saveSheet: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                if allowsMeetingDestination {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Save as")
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(OzerPalette.plumMuted)
                        HStack(spacing: 8) {
                            ForEach([CaptureSaveDestination.meeting, .note]) { option in
                                Button {
                                    destination = option
                                    startError = nil
                                } label: {
                                    Text(option.label)
                                        .font(.subheadline.weight(.semibold))
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 8)
                                        .background(
                                            destination == option ? OzerPalette.coral : OzerPalette.creamDeep,
                                            in: Capsule()
                                        )
                                        .foregroundStyle(destination == option ? Color.white : OzerPalette.plum)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                } else {
                    Text("This recording saves as a note.")
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                }

                if showsClientPicker {
                    clientPicker
                }

                if meetingNeedsClient, selectedClientId == nil {
                    Text(Self.missingClientMessage)
                        .font(.caption)
                        .foregroundStyle(OzerPalette.plumSoft)
                }

                Spacer()

                Button {
                    Task { await confirmSave() }
                } label: {
                    Text("Save")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .disabled(isStopping || (meetingNeedsClient && selectedClientId == nil))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
            .padding(.top, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Save recording")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Discard") {
                        discardPending()
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                    .disabled(isStopping)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var pauseResumeTitle: String {
        if isPausing || (capture.isLabelling && capture.isPaused) {
            return "Pausing…"
        }
        return capture.isPaused ? "Resume" : "Pause"
    }

    private var clientPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(meetingNeedsClient ? "Client" : "Client (optional)")
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)
            Menu {
                if !meetingNeedsClient {
                    Button("No client") {
                        selectedClientId = nil
                    }
                }
                if clients.isEmpty {
                    Text(isLoadingClients ? "Loading clients…" : "No clients in this workspace")
                } else {
                    ForEach(clients) { client in
                        Button(client.displayName) {
                            selectedClientId = client.id
                        }
                    }
                }
            } label: {
                HStack {
                    Text(selectedClient?.displayName ?? (meetingNeedsClient ? "Link a client" : "No client"))
                        .font(.body.weight(.medium))
                        .foregroundStyle(selectedClient == nil ? OzerPalette.plumMuted : OzerPalette.plum)
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
            .disabled(isLoadingClients)
            .accessibilityLabel("Client")
            .accessibilityValue(selectedClient?.displayName ?? "None")
        }
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
        isLoadingClients = true
        defer { isLoadingClients = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let payload = try await api.clients(workspace: workspace, accessToken: token)
            clients = payload.items
        } catch let error as NativeAPIError where error == .unauthorized {
            await session.handleUnauthorized()
        } catch {
            startError = "Couldn’t load clients. \(error.localizedDescription)"
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
            pendingResult = try await capture.stop()
            destination = workspace?.defaultCaptureDestination ?? .note
            showSaveSheet = true
        } catch {
            startError = error.localizedDescription
        }
    }

    private func discardPending() {
        if let url = pendingResult?.audioURL {
            try? FileManager.default.removeItem(at: url)
        }
        pendingResult = nil
        showSaveSheet = false
        dismiss()
    }

    private func confirmSave() async {
        if meetingNeedsClient, selectedClientId == nil {
            startError = Self.missingClientMessage
            return
        }
        guard let result = pendingResult else { return }
        isStopping = true
        defer { isStopping = false }
        let workspaceKey = session.workspaceQueryValue
        let fallback = Self.meetingTitle(on: Date())
        let title = SpeakerTurnSplitter.title(from: result.transcript, fallback: fallback)
        let body = result.transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        let meeting = MeetingStore.shared.save(
            workspace: workspaceKey,
            title: title,
            transcript: body.isEmpty ? title : body,
            duration: result.duration,
            audioURL: result.audioURL,
            turns: result.turns,
            clientId: selectedClientId,
            clientName: selectedClient?.displayName,
            syncTarget: destination.rawValue
        )
        if !workspaceKey.isEmpty, !meeting.transcript.isEmpty {
            switch destination {
            case .meeting:
                if let clientId = selectedClientId {
                    _ = OfflineMeetingQueue.shared.enqueue(
                        workspace: workspaceKey,
                        title: meeting.title,
                        content: meeting.transcript,
                        clientId: clientId,
                        meetingDate: TaskItem.dueString(from: Date()),
                        localMeetingId: meeting.id,
                        durationSeconds: meeting.durationSeconds
                    )
                }
            case .note:
                _ = OfflineNoteQueue.shared.enqueue(
                    workspace: workspaceKey,
                    title: meeting.title,
                    body: meeting.transcript,
                    tags: ["meeting"],
                    category: "meeting_transcript",
                    meetingId: meeting.id,
                    clientId: selectedClientId
                )
            }
            await session.flushOfflineWork()
        }
        showSaveSheet = false
        await onFinished(meeting)
        dismiss()
    }

    static func meetingTitle(on date: Date) -> String {
        "Meeting, \(Self.dayFormatter.string(from: date))"
    }

    static let missingClientMessage = "Link a client so this meeting appears in Ozer."

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "d MMM yyyy"
        return formatter
    }()
}
