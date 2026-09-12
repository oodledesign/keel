import AVFoundation
import SwiftUI

private enum MeetingDetailTab: String, CaseIterable, Identifiable {
    case notes
    case transcript
    case tasks

    var id: String { rawValue }

    var title: String {
        switch self {
        case .notes: "Notes"
        case .transcript: "Transcript"
        case .tasks: "Tasks"
        }
    }
}

struct MeetingDetailView: View {
    let meeting: LocalMeeting
    var remote: MeetingItem?

    @Environment(AppSession.self) private var session
    @State private var player: AVAudioPlayer?
    @State private var isPlaying = false
    @State private var confirmDelete = false
    @State private var playback = MeetingAudioPlayback()
    @State private var detail: MeetingItem?
    @State private var isLoadingDetail = false
    @State private var detailError: NativeAPIError?
    @State private var selectedTab: MeetingDetailTab = .transcript
    @State private var editorTask: TaskItem?
    @State private var showTaskEditor = false
    @State private var showNoteEditor = false

    private let api = NativeAPIClient()

    private var current: LocalMeeting {
        MeetingStore.shared.meeting(id: meeting.id) ?? meeting
    }

    private var isStoredLocally: Bool {
        MeetingStore.shared.meeting(id: current.id) != nil
    }

    private var remoteMeetingId: String? {
        if let remote { return remote.id }
        if current.syncTarget == "note" { return nil }
        return current.remoteNoteId
    }

    private var notesText: String? {
        let text = detail?.notes?.trimmedText ?? ""
        return text.isEmpty ? nil : text
    }

    private var tasks: [MeetingTaskItem] {
        detail?.tasks ?? []
    }

    private var canEditLinkedNote: Bool {
        current.syncTarget == "note" && current.remoteNoteId != nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard

                if current.audioURL != nil {
                    Button {
                        togglePlayback()
                    } label: {
                        Label(isPlaying ? "Pause audio" : "Play audio", systemImage: isPlaying ? "pause.fill" : "play.fill")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(OzerPrimaryButtonStyle())
                }

                tabPicker

                switch selectedTab {
                case .notes:
                    notesCard
                case .transcript:
                    transcriptCard
                case .tasks:
                    tasksCard
                }

                if isStoredLocally {
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        Text("Delete from this iPhone")
                            .font(.body.weight(.medium))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(OzerSecondaryButtonStyle())
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Meeting")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete this meeting from the phone? The audio is removed. A synced meeting stays in Ozer.", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                stopPlayback()
                MeetingStore.shared.delete(id: current.id)
            }
        }
        .sheet(isPresented: $showTaskEditor) {
            TaskEditorView(existing: editorTask) { _ in
                Task { await loadDetail() }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showNoteEditor) {
            NoteEditorView(existing: linkedNote, categories: NoteCategory.system) { _ in
                showNoteEditor = false
            }
        }
        .task(id: remoteMeetingId ?? current.id) {
            applyInitialTab()
            await loadDetail()
        }
        .onDisappear {
            stopPlayback()
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(detail?.displayTitle ?? current.title)
                .font(.title2.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            if let client = detail?.displayClientName ?? current.clientName, !client.isEmpty {
                Text(client)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
            }
            Text(headerMeta)
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
            if current.isWaitingToSync {
                Text(current.syncTarget == "note"
                     ? (OfflineNoteQueue.shared.lastFlushError ?? "Waiting to sync as a note")
                     : (OfflineMeetingQueue.shared.lastFlushError ?? "Waiting to sync"))
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            if let detailError {
                Text(detailError.localizedDescription)
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var headerMeta: String {
        var parts: [String] = []
        if let date = detail?.dateTimeLabel
            ?? MeetingDisplay.dateTimeLabel(meetingDate: nil, instant: current.createdAt) {
            parts.append(date)
        }
        if let duration = detail?.durationLabel ?? (current.durationSeconds > 0 ? current.durationLabel : nil) {
            parts.append(duration)
        }
        if parts.isEmpty {
            return NoteItem.relativeDateLabel(current.createdAt) ?? "Just now"
        }
        return parts.joined(separator: " · ")
    }

    private var tabPicker: some View {
        HStack(spacing: 8) {
            ForEach(MeetingDetailTab.allCases) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    Text(tab.title)
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(
                            selectedTab == tab ? OzerPalette.coral : OzerPalette.creamDeep,
                            in: Capsule()
                        )
                        .foregroundStyle(selectedTab == tab ? Color.white : OzerPalette.plum)
                }
                .buttonStyle(.plain)
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var notesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isLoadingDetail && notesText == nil {
                ProgressView()
                    .tint(OzerPalette.coral)
                    .frame(maxWidth: .infinity)
            } else if let notesText {
                notesMarkdown(notesText)
            } else {
                Text("No notes yet. Summaries are written on Mac or web after this meeting is processed.")
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            if canEditLinkedNote {
                Button {
                    showNoteEditor = true
                } label: {
                    Text("Edit note")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .buttonStyle(OzerSecondaryButtonStyle())
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    @ViewBuilder
    private func notesMarkdown(_ text: String) -> some View {
        if let attributed = try? AttributedString(
            markdown: text,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed)
                .font(.body)
                .foregroundStyle(OzerPalette.plum)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            Text(text)
                .font(.body)
                .foregroundStyle(OzerPalette.plum)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var transcriptCard: some View {
        SpeakerTranscriptView(turns: current.displayTurns)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
    }

    private var tasksCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            if isLoadingDetail && tasks.isEmpty {
                ProgressView()
                    .tint(OzerPalette.coral)
                    .frame(maxWidth: .infinity)
            } else if tasks.isEmpty {
                Text("No saved tasks from this meeting yet. Extract them on Mac or web.")
                    .font(.body)
                    .foregroundStyle(OzerPalette.plumMuted)
            } else {
                ForEach(tasks) { task in
                    if task.canOpenTask {
                        Button {
                            editorTask = task.asTaskItem
                            showTaskEditor = true
                        } label: {
                            taskRow(task)
                        }
                        .buttonStyle(.plain)
                    } else {
                        taskRow(task)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func taskRow(_ task: MeetingTaskItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(task.title)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if let subtitle = task.displaySubtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            if task.canOpenTask {
                Text("Open task")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(OzerPalette.coral)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 4)
    }

    private var linkedNote: NoteItem {
        NoteItem(
            id: current.remoteNoteId ?? current.id,
            title: current.title,
            body: current.transcript,
            workspace: current.workspace,
            createdAt: current.createdAt,
            updatedAt: current.createdAt,
            category: "meeting_transcript",
            clientId: current.clientId,
            clientName: current.clientName
        )
    }

    private func applyInitialTab() {
        if let notes = remote?.notes?.trimmedText, !notes.isEmpty {
            selectedTab = .notes
        } else if remote?.hasExtractedTasks == true {
            selectedTab = .tasks
        } else {
            selectedTab = .transcript
        }
    }

    private func loadDetail() async {
        guard let remoteMeetingId, !remoteMeetingId.isEmpty else {
            detail = remote
            applyLoadedTab()
            return
        }
        isLoadingDetail = true
        defer { isLoadingDetail = false }
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            let loaded = try await api.meeting(
                id: remoteMeetingId,
                workspace: workspace,
                accessToken: token
            )
            detail = loaded
            detailError = nil
            applyLoadedTab()
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            if error != .notFound {
                detailError = error
            }
            if detail == nil {
                detail = remote
            }
        } catch {
            if error.isTaskCancellation { return }
            detailError = .transport(error.localizedDescription)
            if detail == nil {
                detail = remote
            }
        }
    }

    private func applyLoadedTab() {
        if notesText != nil, selectedTab == .transcript, remote?.notes == nil {
            selectedTab = .notes
        }
    }

    private func togglePlayback() {
        if isPlaying {
            stopPlayback()
            return
        }
        guard let url = current.audioURL else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback)
            try AVAudioSession.sharedInstance().setActive(true)
            let next = try AVAudioPlayer(contentsOf: url)
            playback.onFinish = {
                isPlaying = false
                player = nil
            }
            next.delegate = playback
            next.play()
            player = next
            isPlaying = true
        } catch {
            isPlaying = false
        }
    }

    private func stopPlayback() {
        player?.stop()
        player = nil
        isPlaying = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

final class MeetingAudioPlayback: NSObject, AVAudioPlayerDelegate {
    var onFinish: (() -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.onFinish?()
        }
    }
}
