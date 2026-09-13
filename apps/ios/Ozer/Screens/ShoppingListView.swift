import SwiftUI

struct ShoppingListView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: NativeShoppingPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    private let client = NativeAPIClient()
    private var reloadKey: String { session.workspaceContentKey }

    private var items: [NativeShoppingItem] {
        payload?.list?.items ?? []
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView().tint(OzerPalette.coral)
                } else if let loadError {
                    Text(loadError.localizedDescription)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .padding()
                } else if payload?.list == nil {
                    VStack(spacing: 12) {
                        Image(systemName: "cart")
                            .font(.system(size: 28, weight: .medium))
                            .foregroundStyle(OzerPalette.coral)
                        Text("No shopping list yet")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(OzerPalette.plum)
                        Text("Make one from this week’s meal plan on the web.")
                            .font(.body)
                            .foregroundStyle(OzerPalette.plumMuted)
                            .multilineTextAlignment(.center)
                    }
                    .padding(28)
                } else {
                    List {
                        ForEach(grouped, id: \.category) { group in
                            Section(group.label) {
                                ForEach(group.items) { item in
                                    Button {
                                        Task { await toggle(item) }
                                    } label: {
                                        HStack(alignment: .top, spacing: 12) {
                                            Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                                                .foregroundStyle(item.checked ? OzerPalette.coral : OzerPalette.plumSoft)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(item.displayText)
                                                    .strikethrough(item.checked)
                                                    .foregroundStyle(OzerPalette.plum)
                                                if item.inPantry {
                                                    Text("We have this")
                                                        .font(.caption)
                                                        .foregroundStyle(OzerPalette.plumMuted)
                                                }
                                            }
                                            Spacer()
                                        }
                                        .opacity(item.checked || item.inPantry || item.excluded ? 0.5 : 1)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .toolbar {
                        if let text = shareText {
                            ToolbarItem(placement: .topBarTrailing) {
                                ShareLink(item: text) {
                                    Image(systemName: "square.and.arrow.up")
                                }
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Shopping")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { WorkspaceChip() }
            }
            .task(id: reloadKey) { await load() }
            .refreshable { await load() }
        }
    }

    private var grouped: [(category: String, label: String, items: [NativeShoppingItem])] {
        let order = ["produce", "meat_fish", "dairy", "store_cupboard", "other"]
        let labels = [
            "produce": "Produce",
            "meat_fish": "Meat/fish",
            "dairy": "Dairy",
            "store_cupboard": "Store cupboard",
            "other": "Other",
        ]
        return order.compactMap { key in
            let rows = items.filter { $0.category == key }
            guard !rows.isEmpty else { return nil }
            return (key, labels[key] ?? "Other", rows)
        }
    }

    private var shareText: String? {
        guard !items.isEmpty else { return nil }
        return items
            .filter { !$0.excluded }
            .map { item in
                let mark = item.checked ? "[x]" : item.inPantry ? "[have]" : "[ ]"
                return "\(mark) \(item.displayText)"
            }
            .joined(separator: "\n")
    }

    private func toggle(_ item: NativeShoppingItem) async {
        do {
            let token = try await session.validAccessToken()
            _ = try await client.toggleShoppingItem(
                id: item.id,
                checked: !item.checked,
                workspace: session.workspaceQueryValue,
                accessToken: token
            )
            await load()
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

    private func load() async {
        guard !session.workspaceQueryValue.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let token = try await session.validAccessToken()
            payload = try await client.shopping(
                workspace: session.workspaceQueryValue,
                week: nil,
                accessToken: token
            )
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
