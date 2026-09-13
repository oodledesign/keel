import SwiftUI

struct MealPlanView: View {
    @Environment(AppSession.self) private var session
    @State private var payload: NativeMealPlanPayload?
    @State private var loadError: NativeAPIError?
    @State private var isLoading = false
    private let client = NativeAPIClient()
    private var reloadKey: String { session.workspaceContentKey }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && payload == nil && loadError == nil {
                    ProgressView().tint(OzerPalette.coral)
                } else if let loadError {
                    Text(loadError.localizedDescription)
                        .foregroundStyle(OzerPalette.plumMuted)
                        .padding()
                } else if let payload, !payload.dates.isEmpty {
                    List(payload.dates, id: \.self) { date in
                        let entry = payload.entries.first { $0.planDate == date && $0.mealType == "dinner" }
                        VStack(alignment: .leading, spacing: 6) {
                            Text(Self.weekdayLabel(date))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(OzerPalette.plumMuted)
                            Text(entry?.title.isEmpty == false ? entry!.title : "No dinner planned")
                                .font(.body.weight(.medium))
                                .foregroundStyle(OzerPalette.plum)
                            if let cook = entry?.cookMemberName, !cook.isEmpty {
                                Text("Cook: \(cook)")
                                    .font(.caption)
                                    .foregroundStyle(OzerPalette.plumMuted)
                            }
                            if entry?.isBatchPrep == true {
                                Text("Batch prep")
                                    .font(.caption)
                                    .foregroundStyle(OzerPalette.info)
                            }
                            if let warning = entry?.dietaryWarnings.first {
                                Text(warning)
                                    .font(.caption)
                                    .foregroundStyle(OzerPalette.coral)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                } else {
                    Text("No meals this week yet.")
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Meal plan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { WorkspaceChip() }
            }
            .task(id: reloadKey) { await load() }
            .refreshable { await load() }
        }
    }

    private func load() async {
        guard let token = session.accessToken, !session.workspaceQueryValue.isEmpty else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            payload = try await client.mealPlan(
                workspace: session.workspaceQueryValue,
                week: nil,
                accessToken: token
            )
            loadError = nil
        } catch let error as NativeAPIError {
            if error == .unauthorized { await session.signOut() }
            loadError = error
        } catch {
            loadError = .transport(error.localizedDescription)
        }
    }

    private static func weekdayLabel(_ ymd: String) -> String {
        let parts = ymd.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return ymd }
        var components = DateComponents()
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        guard let date = Calendar.current.date(from: components) else { return ymd }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: date)
    }
}
