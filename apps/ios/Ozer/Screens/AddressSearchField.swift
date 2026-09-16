import SwiftUI

/// Typeahead for UK addresses. Suggestions come from the native Mapbox proxy.
struct AddressSearchField: View {
    @Binding var text: String
    var isOnline: Bool
    var label: String = "Property / address"
    var placeholder: String = "Start typing a UK address or postcode"
    var onSelect: (AddressSuggestion) -> Void
    var suggest: (String) async throws -> [AddressSuggestion]

    @State private var suggestions: [AddressSuggestion] = []
    @State private var isLoading = false
    @State private var unavailable = false
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(OzerPalette.plumMuted)

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(OzerPalette.plumSoft)
                TextField(placeholder, text: $text)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .textContentType(.fullStreetAddress)
                    .foregroundStyle(OzerPalette.plum)
                    .focused($isFocused)
                    .accessibilityLabel(label)
                if isLoading {
                    ProgressView()
                        .tint(OzerPalette.coral)
                        .controlSize(.small)
                        .accessibilityLabel("Searching addresses")
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }

            if showsPanel {
                suggestionPanel
            }

            Text(hint)
                .font(.caption)
                .foregroundStyle(OzerPalette.plumSoft)
        }
        .task(id: searchKey) {
            await search()
        }
    }

    private var trimmedQuery: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var searchKey: String {
        "\(trimmedQuery)|\(isOnline)"
    }

    private var showsPanel: Bool {
        trimmedQuery.count >= 3 && (isLoading || unavailable || !isOnline || !suggestions.isEmpty)
    }

    private var hint: String {
        if !isOnline {
            return "You’re offline — enter the address manually."
        }
        return "Select a result to fill the address. You can still type it yourself."
    }

    private var suggestionPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !isOnline {
                statusRow("You’re offline — enter the address manually.")
            } else if isLoading && suggestions.isEmpty {
                statusRow("Looking up addresses…")
            } else if unavailable {
                statusRow("Address search unavailable — enter the address manually.")
            } else if suggestions.isEmpty && !isLoading {
                statusRow("No matches. Try a fuller address or postcode.")
            } else {
                ForEach(suggestions) { suggestion in
                    Button {
                        apply(suggestion)
                    } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "mappin.and.ellipse")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(OzerPalette.plumSoft)
                                .padding(.top, 2)
                            Text(suggestion.label)
                                .font(.subheadline)
                                .foregroundStyle(OzerPalette.plum)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(suggestion.label)

                    if suggestion.id != suggestions.last?.id {
                        Divider().overlay(OzerPalette.border)
                    }
                }
            }
        }
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private func statusRow(_ message: String) -> some View {
        Text(message)
            .font(.subheadline)
            .foregroundStyle(OzerPalette.plumMuted)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
    }

    private func apply(_ suggestion: AddressSuggestion) {
        text = SurveyAddress.formatted(suggestion)
        suggestions = []
        unavailable = false
        isFocused = false
        onSelect(suggestion)
    }

    private func search() async {
        guard isOnline else {
            suggestions = []
            isLoading = false
            unavailable = false
            return
        }
        guard trimmedQuery.count >= 3 else {
            suggestions = []
            isLoading = false
            unavailable = false
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            try await Task.sleep(for: .milliseconds(280))
            try Task.checkCancellation()
            let next = try await suggest(trimmedQuery)
            try Task.checkCancellation()
            suggestions = next
            unavailable = false
        } catch is CancellationError {
            return
        } catch {
            suggestions = []
            unavailable = true
        }
    }
}
