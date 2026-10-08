import SwiftUI

struct MessagePerson: Identifiable, Equatable {
    var userId: String
    var name: String

    var id: String { userId }
}

struct MessageReportTarget: Identifiable, Equatable {
    var threadId: String
    var messageId: String?
    var person: MessagePerson?

    var id: String { messageId ?? "thread-\(threadId)" }
}

struct MessageReportSheet: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    let target: MessageReportTarget
    var onReported: (MessageReportResult) -> Void

    @State private var reason: MessageReportReason = .spam
    @State private var details = ""
    @State private var alsoBlock = false
    @State private var isSending = false
    @State private var errorMessage: String?
    @State private var result: MessageReportResult?

    private let client = NativeAPIClient()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Reason", selection: $reason) {
                        ForEach(MessageReportReason.allCases) { reason in
                            Text(reason.label).tag(reason)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: {
                    Text(target.messageId == nil ? "What’s wrong with this conversation?" : "What’s wrong with this message?")
                }
                .listRowBackground(OzerPalette.panel)

                Section {
                    TextField("Anything that helps us review it", text: $details, axis: .vertical)
                        .lineLimit(3...6)
                        .foregroundStyle(OzerPalette.plum)
                } header: {
                    Text("Details (optional)")
                } footer: {
                    Text("The Ozer team reviews every report within 24 hours and removes content or people that break our terms.")
                        .foregroundStyle(OzerPalette.plumSoft)
                }
                .listRowBackground(OzerPalette.panel)

                if let person = target.person {
                    Section {
                        Toggle("Also block \(person.name)", isOn: $alsoBlock)
                            .tint(OzerPalette.coral)
                    } footer: {
                        Text("You won’t see their messages or get notifications from them. They aren’t told.")
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                    .listRowBackground(OzerPalette.panel)
                }
            }
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle(target.messageId == nil ? "Report conversation" : "Report message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSending ? "Sending…" : "Send") {
                        Task { await submit() }
                    }
                    .foregroundStyle(OzerPalette.coral)
                    .disabled(isSending)
                }
            }
            .alert(
                "Couldn’t send report",
                isPresented: Binding(
                    get: { errorMessage != nil },
                    set: { if !$0 { errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .alert(
                "Thanks for telling us",
                isPresented: Binding(
                    get: { result != nil },
                    set: { if !$0 { finish() } }
                )
            ) {
                Button("Done") { finish() }
            } message: {
                Text(
                    result?.blocked == true
                        ? "We’ll review this within 24 hours. You’ve blocked \(target.person?.name ?? "them")."
                        : "We’ll review this within 24 hours."
                )
            }
        }
    }

    private func submit() async {
        let workspace = session.workspaceQueryValue
        guard !workspace.isEmpty else { return }
        isSending = true
        defer { isSending = false }
        do {
            let token = try await session.validAccessToken()
            result = try await client.reportMessage(
                workspace: workspace,
                threadId: target.threadId,
                messageId: target.messageId,
                reason: reason,
                details: details,
                block: alsoBlock && target.person != nil,
                accessToken: token
            )
        } catch let error as NativeAPIError {
            if error == .unauthorized {
                await session.handleUnauthorized()
            }
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func finish() {
        guard let result else { return }
        self.result = nil
        onReported(result)
        dismiss()
    }
}

struct BlockedPeopleView: View {
    @Environment(AppSession.self) private var session

    @State private var people: [BlockedPerson]?
    @State private var loadError: String?
    @State private var errorMessage: String?
    @State private var pendingUserId: String?

    private let client = NativeAPIClient()

    var body: some View {
        Group {
            if let people {
                if people.isEmpty {
                    ContentUnavailableView(
                        "No one blocked",
                        systemImage: "hand.raised",
                        description: Text("Block someone from a conversation’s menu or by pressing and holding one of their messages.")
                    )
                } else {
                    list(people)
                }
            } else if let loadError {
                VStack(spacing: 12) {
                    Text(loadError)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .multilineTextAlignment(.center)
                    Button("Try again") {
                        Task { await load() }
                    }
                    .foregroundStyle(OzerPalette.coral)
                }
                .padding(24)
            } else {
                OzerListSkeleton(rows: 3, accessibilityLabel: "Loading blocked people")
                    .padding(.horizontal, 20)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream)
        .navigationTitle("Blocked people")
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
        .task { await load() }
    }

    private func list(_ people: [BlockedPerson]) -> some View {
        List {
            Section {
                ForEach(people) { person in
                    HStack {
                        Text(person.displayName)
                            .foregroundStyle(OzerPalette.plum)
                        Spacer()
                        Button(pendingUserId == person.userId ? "Unblocking…" : "Unblock") {
                            Task { await unblock(person) }
                        }
                        .buttonStyle(.borderless)
                        .foregroundStyle(OzerPalette.coral)
                        .disabled(pendingUserId != nil)
                    }
                }
            } footer: {
                Text("You don’t see messages from blocked people or get notifications from them. They aren’t told.")
                    .foregroundStyle(OzerPalette.plumSoft)
            }
            .listRowBackground(OzerPalette.panel)
        }
        .scrollContentBackground(.hidden)
    }

    private func load() async {
        loadError = nil
        do {
            let token = try await session.validAccessToken()
            people = try await client.blockedPeople(accessToken: token)
        } catch {
            if error.isTaskCancellation { return }
            if people == nil {
                loadError = error.localizedDescription
            }
        }
    }

    private func unblock(_ person: BlockedPerson) async {
        pendingUserId = person.userId
        defer { pendingUserId = nil }
        do {
            let token = try await session.validAccessToken()
            try await client.unblockUser(userId: person.userId, accessToken: token)
            people?.removeAll { $0.userId == person.userId }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
