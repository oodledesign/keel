import SwiftUI

struct RecipesListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: NativeRecipesPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    @State private var query = ""

    private let client = NativeAPIClient()
    private var reloadKey: String { session.workspaceContentKey }

    private var items: [NativeRecipeItem] {
        let all = payload?.items ?? []
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return all }
        return all.filter {
            $0.name.localizedCaseInsensitiveContains(trimmed)
                || ($0.description ?? "").localizedCaseInsensitiveContains(trimmed)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let loadError {
                    statusCard(title: "Couldn’t load recipes", message: loadError.localizedDescription)
                } else if items.isEmpty {
                    statusCard(
                        title: "No recipes yet",
                        message: "Add recipes on the web, then they will appear here."
                    )
                } else {
                    List(items) { item in
                        NavigationLink {
                            RecipeDetailView(recipeId: item.id, title: item.name)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Text(item.name)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(OzerPalette.plum)
                                    if item.isFavorite {
                                        Image(systemName: "star.fill")
                                            .foregroundStyle(OzerPalette.coral)
                                            .font(.caption)
                                    }
                                }
                                if !item.subtitle.isEmpty {
                                    Text(item.subtitle)
                                        .font(.subheadline)
                                        .foregroundStyle(OzerPalette.plumMuted)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Recipes")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Search recipes")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { WorkspaceChip() }
            }
            .task(id: reloadKey) { await load() }
            .refreshable {
                await session.refreshWorkspaces()
                await load()
            }
        }
    }

    private func statusCard(title: String, message: String) -> some View {
        VStack(spacing: 12) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundStyle(OzerPalette.plum)
            Text(message)
                .font(.body)
                .foregroundStyle(OzerPalette.plumMuted)
                .multilineTextAlignment(.center)
        }
        .padding(28)
        .frame(maxWidth: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .padding(.horizontal, 20)
    }

    private func load() async {
        guard !session.workspaceQueryValue.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            payload = try await client.recipes(workspace: session.workspaceQueryValue, accessToken: token)
            loadError = nil
        } catch is CancellationError {
            return
        } catch let error as NativeAPIError {
            if error == .unauthorized { await session.handleUnauthorized() }
            loadError = error
        } catch {
            if error.isTaskCancellation { return }
            loadError = .transport(error.localizedDescription)
        }
    }
}
