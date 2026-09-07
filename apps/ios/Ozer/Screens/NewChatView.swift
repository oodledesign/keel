import SwiftUI

struct NewChatView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    var onCreated: (String) -> Void

    @State private var query = ""
    @State private var options: [MessageComposeOption] = []
    @State private var selectedPeople: [MessageComposeOption] = []
    @State private var selectedContacts: [MessageComposeOption] = []
    @State private var selectedClient: MessageComposeOption?
    @State private var selectedJob: MessageComposeOption?
    @State private var title = ""
    @State private var loadError: NativeAPIError?
    @State private var isSearching = false
    @State private var isCreating = false

    private let client = NativeAPIClient()

    private var chips: [MessageComposeOption] {
        selectedPeople + selectedContacts + [selectedClient, selectedJob].compactMap { $0 }
    }

    private var composeType: String {
        if selectedClient != nil { return "client" }
        if selectedJob != nil { return "job" }
        return selectedPeople.count + selectedContacts.count == 1 ? "direct" : "group"
    }

    private var whoCanSee: String {
        let names = ["You"]
            + selectedPeople.map(\.name)
            + selectedContacts.map(\.name)
        if let selectedClient {
            let extras = names.dropFirst()
            let extra = extras.isEmpty ? "" : " plus \(extras.joined(separator: ", "))"
            return "You and every portal contact for \(selectedClient.name)\(extra). New portal contacts join automatically."
        }
        if let selectedJob {
            if names.count == 1 {
                return "You on \(selectedJob.name). Only people you add can see this."
            }
            return "\(names.joined(separator: ", ")) on \(selectedJob.name). Only these people can see this."
        }
        if names.count <= 1 {
            return "Add a teammate, contact, client, or project."
        }
        if names.count == 2 {
            return "Only \(names[0]) and \(names[1]) can see this."
        }
        return "Only \(names.joined(separator: ", ")) can see this."
    }

    private var canCreate: Bool {
        selectedClient != nil
            || selectedJob != nil
            || !selectedPeople.isEmpty
            || !selectedContacts.isEmpty
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                searchField
                if !chips.isEmpty {
                    chipRow
                }
                Text(whoCanSee)
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .padding(.horizontal, 4)
                if composeType == "group" || selectedJob != nil || selectedClient != nil {
                    TextField("Chat name (optional)", text: $title)
                        .padding(12)
                        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(OzerPalette.border, lineWidth: 1)
                        }
                }
                results
            }
            .padding(20)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("New chat")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", action: dismiss.callAsFunction)
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(isCreating ? "Starting…" : "Start") {
                        Task { await create() }
                    }
                    .disabled(!canCreate || isCreating)
                    .foregroundStyle(canCreate ? OzerPalette.coral : OzerPalette.plumSoft)
                }
            }
            .task {
                await search()
            }
            .onChange(of: query) { _, _ in
                Task { await search() }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(OzerPalette.plumSoft)
            TextField("Search people, clients, projects", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(12)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var chipRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(chips) { chip in
                    Button {
                        remove(chip)
                    } label: {
                        HStack(spacing: 6) {
                            Text(chip.name)
                                .font(.caption.weight(.semibold))
                            Image(systemName: "xmark")
                                .font(.caption2.weight(.bold))
                        }
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(OzerPalette.coral, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(chip.name)")
                }
            }
        }
    }

    @ViewBuilder
    private var results: some View {
        if let loadError {
            Text(loadError.localizedDescription)
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
        } else if isSearching && options.isEmpty {
            ProgressView()
                .tint(OzerPalette.coral)
                .frame(maxWidth: .infinity, alignment: .center)
        } else if options.isEmpty {
            Text("No people, clients, or projects match.")
                .font(.subheadline)
                .foregroundStyle(OzerPalette.plumMuted)
        } else {
            ScrollView {
                VStack(spacing: 8) {
                    ForEach(options) { option in
                        Button {
                            toggle(option)
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: option.symbol)
                                    .foregroundStyle(OzerPalette.coral)
                                    .frame(width: 28)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(option.name)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(OzerPalette.plum)
                                    Text(option.subtitle ?? option.kindLabel)
                                        .font(.caption)
                                        .foregroundStyle(OzerPalette.plumMuted)
                                }
                                Spacer()
                                if isSelected(option) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(OzerPalette.coral)
                                }
                            }
                            .padding(14)
                            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
                            .overlay {
                                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                                    .stroke(OzerPalette.border, lineWidth: 1)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func isSelected(_ option: MessageComposeOption) -> Bool {
        switch option.kind {
        case "client": selectedClient?.id == option.id
        case "job": selectedJob?.id == option.id
        case "contact": selectedContacts.contains(where: { $0.id == option.id })
        default: selectedPeople.contains(where: { $0.id == option.id })
        }
    }

    private func toggle(_ option: MessageComposeOption) {
        switch option.kind {
        case "client":
            selectedClient = selectedClient?.id == option.id ? nil : option
            if selectedClient != nil { selectedJob = nil }
        case "job":
            selectedJob = selectedJob?.id == option.id ? nil : option
            if selectedJob != nil { selectedClient = nil }
        case "contact":
            if let index = selectedContacts.firstIndex(where: { $0.id == option.id }) {
                selectedContacts.remove(at: index)
            } else {
                selectedContacts.append(option)
            }
        default:
            if let index = selectedPeople.firstIndex(where: { $0.id == option.id }) {
                selectedPeople.remove(at: index)
            } else {
                selectedPeople.append(option)
            }
        }
    }

    private func remove(_ option: MessageComposeOption) {
        switch option.kind {
        case "client": selectedClient = nil
        case "job": selectedJob = nil
        case "contact": selectedContacts.removeAll { $0.id == option.id }
        default: selectedPeople.removeAll { $0.id == option.id }
        }
    }

    private func search() async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else { return }
        isSearching = true
        defer { isSearching = false }
        do {
            let token = try await session.validAccessToken()
            let payload = try await client.messageCompose(
                workspace: workspace,
                query: query,
                accessToken: token
            )
            options = payload.items
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            loadError = error
        } catch {
            loadError = .transport(error.localizedDescription)
        }
    }

    private func create() async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty, canCreate else { return }
        isCreating = true
        defer { isCreating = false }
        do {
            let token = try await session.validAccessToken()
            let created = try await client.createMessageThread(
                workspace: workspace,
                type: composeType,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                jobId: selectedJob?.id,
                clientId: selectedClient?.id,
                memberUserIds: selectedPeople.map(\.id),
                contactIds: selectedContacts.map(\.id),
                accessToken: token
            )
            onCreated(created.threadId)
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
