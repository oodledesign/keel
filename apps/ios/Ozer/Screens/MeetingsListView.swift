import SwiftUI

struct MeetingsListView: View {
    @Environment(AppSession.self) private var session
    @State private var remoteMeetings: [MeetingItem] = []
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var isRecording = false
    @State private var selectedMeeting: LocalMeeting?
    @State private var meetingStore = MeetingStore.shared
    @State private var meetingQueue = OfflineMeetingQueue.shared
    @State private var noteQueue = OfflineNoteQueue.shared

    private let client = NativeAPIClient()

    private var reloadKey: String {
        session.workspaceContentKey
    }

    private var showsMeetings: Bool {
        session.selectedWorkspace?.showsMeetings == true
    }

    private var workspace: String {
        session.workspaceQueryValue
    }

    private var localMeetings: [LocalMeeting] {
        meetingStore.meetings(for: workspace)
    }

    private var rows: [MeetingListRow] {
        Self.merge(local: localMeetings, remote: remoteMeetings)
    }

    var body: some View {
        NavigationStack {
            Group {
                if !showsMeetings && session.workspacesLoaded {
                    unavailableCard
                } else if isLoading && rows.isEmpty && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError, rows.isEmpty {
                    statusCard(error: loadError)
                } else if session.workspacesLoaded && workspace.isEmpty {
                    membershipsEmptyCard
                } else if !rows.isEmpty {
                    content(rows)
                } else {
                    emptyCard
                }
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Meetings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                if showsMeetings, !workspace.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            isRecording = true
                        } label: {
                            Image(systemName: "record.circle")
                                .foregroundStyle(OzerPalette.coral)
                        }
                        .accessibilityLabel("Record a meeting")
                    }
                }
            }
            .task(id: reloadKey) {
                await load()
            }
            .refreshable {
                await session.flushOfflineWork()
                await session.refreshWorkspaces()
                await load()
            }
            .fullScreenCover(isPresented: $isRecording) {
                MeetingRecordView { meeting in
                    selectedMeeting = meeting
                    await load()
                }
            }
            .navigationDestination(item: $selectedMeeting) { meeting in
                MeetingDetailView(meeting: meeting)
            }
        }
    }

    private func content(_ rows: [MeetingListRow]) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Button {
                    isRecording = true
                } label: {
                    Label("Record meeting", systemImage: "record.circle")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())

                if let flushError = meetingQueue.lastFlushError ?? noteQueue.lastFlushError {
                    Text(flushError)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                }

                ForEach(rows) { row in
                    if let meeting = row.local {
                        NavigationLink {
                            MeetingDetailView(meeting: meeting)
                        } label: {
                            meetingRow(row)
                        }
                        .buttonStyle(.plain)
                    } else if let remote = row.remote {
                        NavigationLink {
                            MeetingDetailView(meeting: remote.asLocalMeeting())
                        } label: {
                            meetingRow(row)
                        }
                        .buttonStyle(.plain)
                    } else {
                        meetingRow(row)
                    }
                }
            }
            .padding(.top, 8)
        }
    }

    private func meetingRow(_ row: MeetingListRow) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(row.title)
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if let subtitle = row.subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .lineLimit(2)
            }
            if row.waiting {
                Text(meetingQueue.lastFlushError == nil
                     ? "Waiting to sync"
                     : "Couldn’t sync")
                    .font(.caption)
                    .foregroundStyle(OzerPalette.plumSoft)
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

    private var unavailableCard: some View {
        VStack(spacing: 12) {
            Text("Meetings stay on workspaces")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Record in-room meetings on surveyor, studio, and commercial spaces. Personal and family keep field notes instead.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var membershipsEmptyCard: some View {
        VStack(spacing: 12) {
            Text("No workspaces yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("When your memberships load, meetings will land here.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task {
                    await session.refreshWorkspaces()
                    await load()
                }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
            .disabled(session.isRefreshingWorkspaces)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var emptyCard: some View {
        VStack(spacing: 12) {
            Text("No meetings yet")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Record a meeting in this room. Captions stay on this iPhone, and the transcript syncs to Ozer Meetings when you’re online.")
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Record meeting") {
                isRecording = true
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 180)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text(error == .notFound ? "Meetings aren’t available yet" : "Couldn’t load meetings")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            if error != .unauthorized && error != .notFound {
                Button("Try again") {
                    Task { await load() }
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .frame(width: 140)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func load() async {
        guard showsMeetings else {
            remoteMeetings = []
            loadError = nil
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            if !session.workspacesLoaded {
                await session.refreshWorkspaces()
            }
            try Task.checkCancellation()
            guard !workspace.isEmpty else {
                remoteMeetings = []
                loadError = nil
                return
            }
            await session.flushOfflineWork()
            let payload = try await client.meetings(
                workspace: workspace,
                accessToken: token
            )
            remoteMeetings = payload.items
            loadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            if localMeetings.isEmpty {
                loadError = error
            }
        } catch {
            if error.isTaskCancellation { return }
            if localMeetings.isEmpty {
                loadError = .transport(error.localizedDescription)
            }
        }
    }

    static func merge(local: [LocalMeeting], remote: [MeetingItem]) -> [MeetingListRow] {
        let linkedIds = Set(local.compactMap(\.remoteNoteId))
        let localRows = local.map { meeting in
            MeetingListRow(
                id: meeting.id,
                title: meeting.title,
                subtitle: Self.subtitle(for: meeting),
                waiting: meeting.isWaitingToSync,
                local: meeting,
                remote: nil
            )
        }
        let remoteRows = remote.compactMap { item -> MeetingListRow? in
            if linkedIds.contains(item.id) { return nil }
            return MeetingListRow(
                id: item.id,
                title: item.displayTitle,
                subtitle: item.displaySubtitle,
                waiting: false,
                local: nil,
                remote: item
            )
        }
        return localRows + remoteRows
    }

    static func subtitle(for meeting: LocalMeeting) -> String {
        var parts: [String] = [meeting.durationLabel]
        if let client = meeting.clientName?.trimmingCharacters(in: .whitespacesAndNewlines), !client.isEmpty {
            parts.append(client)
        }
        if let date = NoteItem.relativeDateLabel(meeting.createdAt), !date.isEmpty {
            parts.append(date)
        }
        return parts.joined(separator: " · ")
    }
}

struct MeetingListRow: Identifiable, Equatable {
    var id: String
    var title: String
    var subtitle: String?
    var waiting: Bool
    var local: LocalMeeting?
    var remote: MeetingItem?
}
