import SwiftUI

enum AIConsentCopy {
    static let providers: [(name: String, use: String)] = [
        ("Anthropic (Claude)", "meeting summaries and suggested tasks"),
        ("Google (Gemini)", "tidying and sorting survey dictation"),
        ("Voyage AI", "searching across your workspace"),
    ]

    static let privacyPolicy = URL(string: "https://www.ozer.so/privacy-policy")!
}

/// Asked once after sign-in, before any meeting, survey or note is uploaded.
struct AIConsentView: View {
    @Environment(AppSession.self) private var session
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                OzerFlowerMark(size: 44)
                    .accessibilityHidden(true)

                Text("AI features")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(OzerPalette.plum)

                Text("Ozer can summarise your meetings, suggest follow-up tasks, tidy up survey dictation and search your workspace. To do that, it sends the text of your meetings, survey notes and notes to these AI providers:")
                    .foregroundStyle(OzerPalette.plumMuted)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(alignment: .leading, spacing: 12) {
                    ForEach(AIConsentCopy.providers, id: \.name) { provider in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(provider.name)
                                .font(.body.weight(.semibold))
                                .foregroundStyle(OzerPalette.plum)
                            Text(provider.use)
                                .font(.subheadline)
                                .foregroundStyle(OzerPalette.plumMuted)
                        }
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.button, style: .continuous))

                Text("Recordings are transcribed on this \(OzerDevice.name); audio isn’t sent to these providers. If you don’t allow this, meetings and surveys are still saved, just without AI summaries, suggested tasks or search. You can change this any time in Personal settings.")
                    .font(.footnote)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .fixedSize(horizontal: false, vertical: true)

                Link("Read the privacy policy", destination: AIConsentCopy.privacyPolicy)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(OzerPalette.coral)

                VStack(spacing: 12) {
                    Button(isSaving ? "Saving…" : "Allow") {
                        Task { await choose(granted: true) }
                    }
                    .buttonStyle(OzerPrimaryButtonStyle())

                    Button("Don’t allow") {
                        Task { await choose(granted: false) }
                    }
                    .buttonStyle(OzerSecondaryButtonStyle())
                }
                .disabled(isSaving)
                .padding(.top, 4)
            }
            .padding(24)
        }
        .background(OzerPalette.cream.ignoresSafeArea())
        .interactiveDismissDisabled()
        .alert(
            "Couldn’t save your choice",
            isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func choose(granted: Bool) async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await session.setAIConsent(granted: granted)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
