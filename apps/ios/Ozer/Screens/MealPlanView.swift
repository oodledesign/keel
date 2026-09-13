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
                        let dayEntries = payload.entries
                            .filter { $0.planDate == date }
                            .sorted { Self.mealOrder($0.mealType) < Self.mealOrder($1.mealType) }
                        VStack(alignment: .leading, spacing: 8) {
                            Text(Self.weekdayLabel(date))
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(OzerPalette.plumMuted)
                            if dayEntries.isEmpty {
                                Text("Nothing planned")
                                    .font(.body)
                                    .foregroundStyle(OzerPalette.plumMuted)
                            } else {
                                ForEach(dayEntries) { entry in
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(Self.mealLabel(entry.mealType))
                                            .font(.caption2.weight(.semibold))
                                            .foregroundStyle(OzerPalette.plumMuted)
                                        Text(entry.title.isEmpty ? "Untitled" : entry.title)
                                            .font(.body.weight(.medium))
                                            .foregroundStyle(OzerPalette.plum)
                                        HStack(spacing: 8) {
                                            if let cook = entry.cookMemberName, !cook.isEmpty {
                                                Text(cook)
                                            }
                                            if entry.isBatchPrep {
                                                Text("Batch")
                                            }
                                            if entry.leftoverSourceEntryId != nil {
                                                Text("Leftovers")
                                            }
                                        }
                                        .font(.caption)
                                        .foregroundStyle(OzerPalette.plumMuted)
                                        if let warning = entry.dietaryWarnings.first {
                                            Text(warning)
                                                .font(.caption)
                                                .foregroundStyle(OzerPalette.coral)
                                        }
                                    }
                                }
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

    private static func mealOrder(_ type: String) -> Int {
        switch type {
        case "breakfast": return 0
        case "lunch": return 1
        case "dinner": return 2
        case "snack": return 3
        default: return 9
        }
    }

    private static func mealLabel(_ type: String) -> String {
        type.replacingOccurrences(of: "_", with: " ").capitalized
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
