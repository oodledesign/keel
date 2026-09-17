import SwiftUI

struct SurveysListView: View {
    @Environment(AppSession.self) private var session
    @State private var store = SurveyStore.shared
    @State private var queue = OfflineSurveyQueue.shared
    @State private var network = NetworkPathMonitor.shared
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var showCreate = false
    @State private var selected: SurveyItem?

    private let client = NativeAPIClient()

    private var workspace: String {
        session.workspaceQueryValue
    }

    private var showsSurveys: Bool {
        session.selectedWorkspace?.showsSurveys == true
    }

    private var rows: [SurveyItem] {
        store.surveys(for: workspace)
    }

    private var queueStatus: SurveyQueueStatus {
        SurveyDisplay.queueStatus(
            isOnline: network.isOnline,
            pendingCount: queue.pendingCount(for: workspace),
            lastError: queue.lastFlushError
        )
    }

    var body: some View {
        NavigationStack {
            Group {
                if !showsSurveys && session.workspacesLoaded {
                    unavailableCard
                } else if isLoading && rows.isEmpty && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError, rows.isEmpty {
                    statusCard(error: loadError)
                } else if session.workspacesLoaded && workspace.isEmpty {
                    membershipsEmptyCard
                } else {
                    content
                }
            }
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Surveys")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    WorkspaceChip()
                }
                if showsSurveys, !workspace.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showCreate = true
                        } label: {
                            Image(systemName: "plus")
                                .foregroundStyle(OzerPalette.coral)
                        }
                        .accessibilityLabel("Create survey")
                    }
                }
            }
            .task(id: session.workspaceContentKey) {
                await load()
            }
            .refreshable {
                await session.flushOfflineWork()
                await session.refreshWorkspaces()
                await load()
            }
            .sheet(isPresented: $showCreate) {
                CreateSurveySheet { survey in
                    selected = survey
                    await load()
                }
            }
            .navigationDestination(item: $selected) { survey in
                SurveyDetailView(survey: survey)
            }
        }
    }

    private var content: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Button {
                    showCreate = true
                } label: {
                    Label("New survey", systemImage: "plus.circle")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())

                queueBanner

                if rows.isEmpty {
                    emptyCard
                } else {
                    ForEach(rows) { item in
                        NavigationLink {
                            SurveyDetailView(survey: item)
                        } label: {
                            surveyRow(item)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 88)
        }
    }

    private var queueBanner: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(network.isOnline ? OzerPalette.coral : OzerPalette.plumSoft)
                .frame(width: 8, height: 8)
            Text(queueStatus.banner)
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
            Spacer()
        }
        .padding(12)
        .background(OzerPalette.creamDeep, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
    }

    private func surveyRow(_ item: SurveyItem) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(item.title)
                    .font(.body.weight(.medium))
                    .foregroundStyle(OzerPalette.plum)
                    .lineLimit(2)
                Spacer(minLength: 0)
                SurveyStatusBadge(status: item.status)
            }
            Text(item.typeLabel)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            if let client = item.clientName, !client.isEmpty {
                Text(client)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
            }
            Text(meta(for: item))
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
            if item.isLocal {
                Text("Waiting to sync")
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

    private func meta(for item: SurveyItem) -> String {
        let sessions = item.sessionCount + queue.sessions(forSurvey: item.id, workspace: workspace).count
        let photos = item.photoCount + queue.photos(forSurvey: item.id, workspace: workspace).count
        return "\(sessions) session\(sessions == 1 ? "" : "s") · \(photos) photo\(photos == 1 ? "" : "s")"
    }

    private var emptyCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("No surveys yet")
                .font(.body.weight(.medium))
                .foregroundStyle(OzerPalette.plum)
            Text("Create a survey for the property, then record as you walk. Dictation stays on this iPhone until you are back online.")
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
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
            Text("Surveys stay on surveyor workspaces")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text("Switch to a building-surveyor workspace to record site notes into a survey. Meetings and notes are unchanged on other spaces.")
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
            Text("When your memberships load, surveys will land here.")
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

    private func statusCard(error: NativeAPIError) -> some View {
        VStack(spacing: 12) {
            Text("Couldn’t load surveys")
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(error.localizedDescription)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            if error != .unauthorized {
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
        guard showsSurveys else {
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
                loadError = nil
                return
            }
            await session.flushOfflineWork()
            let payload = try await client.surveys(workspace: workspace, accessToken: token)
            store.replaceRemote(workspace: workspace, items: payload.items)
            loadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            loadError = error
        } catch {
            loadError = .transport(error.localizedDescription)
        }
    }
}

struct CreateSurveySheet: View {
    var onCreated: (SurveyItem) async -> Void

    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var postcode = ""
    @State private var latitude: Double?
    @State private var longitude: Double?
    @State private var selectedAddress: String?
    @State private var surveyType = SurveyTypeOption.default
    @State private var selectedClientId: String?
    @State private var clients: [ClientItem] = []
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var network = NetworkPathMonitor.shared

    private let api = NativeAPIClient()

    var body: some View {
        NavigationStack {
            ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                AddressSearchField(
                    text: $title,
                    isOnline: network.isOnline,
                    onSelect: applySuggestion
                ) { query in
                    try await suggestAddresses(query)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Survey type")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(OzerPalette.plumMuted)
                    Menu {
                        ForEach(SurveyTypeOption.allCases) { option in
                            Button(option.label) { surveyType = option }
                        }
                    } label: {
                        HStack {
                            Text(surveyType.label)
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
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Client (optional)")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(OzerPalette.plumMuted)
                    Menu {
                        Button("No client") { selectedClientId = nil }
                        ForEach(clients) { client in
                            Button(client.displayName) { selectedClientId = client.id }
                        }
                    } label: {
                        HStack {
                            Text(selectedClient?.displayName ?? "No client")
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
                }

                if let errorMessage {
                    Text(errorMessage)
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                }

                Spacer()

                Button {
                    Task { await save() }
                } label: {
                    Text(isSaving ? "Saving…" : "Create survey")
                        .font(.body.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(OzerPrimaryButtonStyle())
                .disabled(isSaving || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(20)
            }
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("New survey")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .task { await loadClients() }
            .onChange(of: title) { _, newValue in
                if let selectedAddress, newValue != selectedAddress {
                    latitude = nil
                    longitude = nil
                    self.selectedAddress = nil
                    postcode = SurveyAddress.extractUkPostcode(from: newValue) ?? ""
                }
            }
        }
        .presentationDetents([.large])
    }

    private var selectedClient: ClientItem? {
        clients.first { $0.id == selectedClientId }
    }

    private func loadClients() async {
        do {
            let token = try await session.validAccessToken()
            let workspace = session.workspaceQueryValue
            guard !workspace.isEmpty else { return }
            clients = try await api.clients(workspace: workspace, accessToken: token).items
        } catch {
            return
        }
    }

    private func applySuggestion(_ suggestion: AddressSuggestion) {
        title = SurveyAddress.formatted(suggestion)
        selectedAddress = title
        postcode = suggestion.postcode?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        latitude = suggestion.latitude
        longitude = suggestion.longitude
        errorMessage = nil
    }

    private func suggestAddresses(_ query: String) async throws -> [AddressSuggestion] {
        let token = try await session.validAccessToken()
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else { return [] }
        return try await api.suggestAddresses(
            query: query,
            workspace: workspace,
            accessToken: token
        )
    }

    private func save() async {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSaving = true
        defer { isSaving = false }
        let workspace = session.workspaceQueryValue
        let resolvedPostcode = postcode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? SurveyAddress.extractUkPostcode(from: trimmed)
            : postcode.trimmingCharacters(in: .whitespacesAndNewlines)
        let local = SurveyStore.shared.saveLocal(
            workspace: workspace,
            title: trimmed,
            surveyType: surveyType,
            clientId: selectedClientId,
            clientName: selectedClient?.displayName,
            propertyAddress: trimmed,
            propertyPostcode: resolvedPostcode
        )
        _ = OfflineSurveyQueue.shared.enqueueCreate(
            id: local.id,
            workspace: workspace,
            title: trimmed,
            surveyType: surveyType.rawValue,
            clientId: selectedClientId,
            clientName: selectedClient?.displayName,
            address: trimmed,
            postcode: resolvedPostcode,
            latitude: latitude,
            longitude: longitude
        )
        await session.flushOfflineWork()
        let created = SurveyStore.shared.survey(id: local.id) ?? local
        await onCreated(created)
        dismiss()
    }
}
