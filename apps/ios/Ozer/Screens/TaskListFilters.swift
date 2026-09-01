import SwiftUI

protocol TaskFilterChipItem: Hashable, Identifiable {
    var label: String { get }
}

enum TaskDueFilter: String, CaseIterable, Identifiable, TaskFilterChipItem {
    case all
    case today
    case overdue
    case upcoming
    case noDate

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: "All"
        case .today: "Today"
        case .overdue: "Overdue"
        case .upcoming: "Upcoming"
        case .noDate: "No date"
        }
    }
}

enum TaskStatusFilter: String, CaseIterable, Identifiable, TaskFilterChipItem {
    case open
    case done
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .open: "Open"
        case .done: "Done"
        case .all: "All"
        }
    }

    var queryValue: String { rawValue }
}

enum TaskClientFilter: Hashable, Identifiable {
    case all
    case none
    case client(id: String, name: String)

    var id: String {
        switch self {
        case .all: "all"
        case .none: "none"
        case .client(let id, _): id
        }
    }

    var label: String {
        switch self {
        case .all:
            return "All clients"
        case .none:
            return "No client"
        case .client(_, let name):
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? "Client" : trimmed
        }
    }

    var apiClientId: String? {
        switch self {
        case .client(let id, _): id
        default: nil
        }
    }
}

extension TaskItem {
    func matchesSearch(_ query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if needle.isEmpty { return true }
        if title.localizedCaseInsensitiveContains(needle) { return true }
        if let clientName, clientName.localizedCaseInsensitiveContains(needle) {
            return true
        }
        return false
    }

    func matchesDue(_ filter: TaskDueFilter, today: Date = Date(), calendar: Calendar = .current) -> Bool {
        switch filter {
        case .all:
            true
        case .noDate:
            due == nil || due?.isEmpty == true
        case .today, .overdue, .upcoming:
            Self.matchesDatedDue(filter, due: due, today: today, calendar: calendar)
        }
    }

    func matchesClient(_ filter: TaskClientFilter) -> Bool {
        switch filter {
        case .all:
            true
        case .none:
            clientId == nil || clientId?.isEmpty == true
        case .client(let id, _):
            clientId == id
        }
    }

    private static func matchesDatedDue(
        _ filter: TaskDueFilter,
        due: String?,
        today: Date,
        calendar: Calendar
    ) -> Bool {
        guard let date = Self.dueDate(from: due) else { return false }
        let dueDay = calendar.startOfDay(for: date)
        let todayDay = calendar.startOfDay(for: today)
        switch filter {
        case .today:
            return dueDay == todayDay
        case .overdue:
            return dueDay < todayDay
        case .upcoming:
            return dueDay > todayDay
        default:
            return true
        }
    }
}

struct TaskFilterChip: View {
    var title: String
    var isSelected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Color.white : OzerPalette.plum)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    isSelected ? OzerPalette.coral : OzerPalette.panel,
                    in: Capsule()
                )
                .overlay {
                    Capsule()
                        .stroke(isSelected ? Color.clear : OzerPalette.border, lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

struct TaskClientFilterSheet: View {
    @Environment(\.dismiss) private var dismiss

    var clients: [ClientItem]
    var selection: TaskClientFilter
    var onSelect: (TaskClientFilter) -> Void

    var body: some View {
        NavigationStack {
            List {
                row("All clients", selected: selection == .all) {
                    onSelect(.all)
                    dismiss()
                }
                row("No client", selected: selection == .none) {
                    onSelect(.none)
                    dismiss()
                }
                ForEach(clients) { client in
                    row(client.displayName, selected: selection.id == client.id) {
                        onSelect(.client(id: client.id, name: client.displayName))
                        dismiss()
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(OzerPalette.cream)
            .navigationTitle("Client")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(OzerPalette.plumMuted)
                }
            }
        }
    }

    private func row(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(OzerPalette.plum)
                Spacer()
                if selected {
                    Image(systemName: "checkmark")
                        .fontWeight(.semibold)
                        .foregroundStyle(OzerPalette.coral)
                }
            }
        }
        .listRowBackground(OzerPalette.panel)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
