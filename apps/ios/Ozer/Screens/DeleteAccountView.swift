import SwiftUI

struct DeleteAccountView: View {
    @Environment(AppSession.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var preview: AccountDeletionPreview?
    @State private var loadError: String?
    @State private var confirmation = ""
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if let preview {
                    form(preview)
                } else if let loadError {
                    failedState(loadError)
                } else {
                    OzerListSkeleton(rows: 3, accessibilityLabel: "Loading account details")
                        .padding(.horizontal, 20)
                }
            }
            .background(OzerPalette.cream)
            .navigationTitle("Delete account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                        .disabled(isDeleting)
                }
            }
        }
        .interactiveDismissDisabled(isDeleting)
        .task { await load() }
    }

    private func form(_ preview: AccountDeletionPreview) -> some View {
        List {
            Section {
                Text("Your account is locked straight away and permanently deleted after \(preview.graceDays) days — your Personal workspace, tasks, notes, meetings, memories, and files.")
                    .foregroundStyle(OzerPalette.plum)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Changed your mind? Email privacy@ozer.so before then and we’ll restore it. Recordings and photos still waiting on this iPhone are removed when you delete the app.")
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .listRowBackground(OzerPalette.panel)

            if !preview.soloWorkspaces.isEmpty {
                Section {
                    ForEach(preview.soloWorkspaces) { workspace in
                        Text(workspace.name)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(OzerPalette.plum)
                    }
                } header: {
                    Text("Also deleted")
                } footer: {
                    Text("Only you are in these workspaces.")
                        .foregroundStyle(OzerPalette.plumSoft)
                }
                .listRowBackground(OzerPalette.panel)
            }

            if !preview.deletionEnabled {
                Section {
                    Text("Account deletion isn’t available right now. Email privacy@ozer.so and we’ll handle it for you.")
                        .foregroundStyle(OzerPalette.plumMuted)
                }
                .listRowBackground(OzerPalette.panel)
            } else if !preview.blockers.isEmpty {
                Section {
                    ForEach(preview.blockers) { blocker in
                        Text(blocker.message)
                            .foregroundStyle(OzerPalette.plum)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    if preview.needsRecentSignIn {
                        Button("Sign out and sign in again") {
                            Task { await session.signOut() }
                        }
                        .foregroundStyle(OzerPalette.coral)
                    }
                } header: {
                    Text("You can’t delete your account yet")
                }
                .listRowBackground(OzerPalette.panel)
            } else {
                Section {
                    TextField("Type \(AccountDeletionPreview.confirmationWord) to confirm", text: $confirmation)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .foregroundStyle(OzerPalette.plum)
                        .disabled(isDeleting)

                    Button(role: .destructive) {
                        Task { await deleteAccount() }
                    } label: {
                        HStack {
                            Text(isDeleting ? "Scheduling…" : "Delete my account")
                            if isDeleting {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(!isConfirmed || isDeleting)
                } footer: {
                    if let errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(OzerPalette.coral)
                    }
                }
                .listRowBackground(OzerPalette.panel)
            }
        }
        .scrollContentBackground(.hidden)
    }

    private func failedState(_ message: String) -> some View {
        VStack(spacing: 12) {
            Text(message)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await load() }
            }
            .buttonStyle(OzerPrimaryButtonStyle())
            .frame(width: 140)
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var isConfirmed: Bool {
        confirmation.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
            == AccountDeletionPreview.confirmationWord
    }

    private func load() async {
        loadError = nil
        do {
            preview = try await session.accountDeletionPreview()
        } catch NativeAPIError.unauthorized {
            await session.handleUnauthorized()
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func deleteAccount() async {
        errorMessage = nil
        isDeleting = true
        defer { isDeleting = false }
        do {
            try await session.deleteAccount()
        } catch NativeAPIError.unauthorized {
            await session.handleUnauthorized()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
