import SwiftUI

struct DictationSheet: View {
    var onSave: (String, String) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var speech = OnDeviceSpeechSession()
    @State private var pressStartedAt: Date?
    @State private var tapLocked = false
    @State private var isSaving = false
    @State private var isStarting = false
    @State private var permissionError: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                liveCard
                Spacer(minLength: 8)
                micControl
                Text(hint)
                    .font(.subheadline)
                    .foregroundStyle(OzerPalette.plumMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(OzerPalette.cream.ignoresSafeArea())
            .navigationTitle("Dictate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        _ = speech.stop()
                        dismiss()
                    }
                    .foregroundStyle(OzerPalette.plumMuted)
                }
            }
        }
        .onDisappear {
            if speech.isListening {
                _ = speech.stop()
            }
        }
    }

    private var hint: String {
        if let permissionError {
            return permissionError
        }
        if let lastError = speech.lastError {
            return lastError
        }
        if speech.isListening {
            return tapLocked ? "Listening. Tap the mic to save." : "Release to save, or keep holding."
        }
        return "Hold or tap the mic. Ozer transcribes on this iPhone — it works offline."
    }

    private var liveCard: some View {
        ScrollView {
            Text(speech.displayText.isEmpty ? "Your words will land here." : speech.displayText)
                .font(.title3.weight(.medium))
                .foregroundStyle(speech.displayText.isEmpty ? OzerPalette.plumMuted : OzerPalette.plum)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                .stroke(OzerPalette.border, lineWidth: 1)
        }
    }

    private var micControl: some View {
        Circle()
            .fill(speech.isListening ? OzerPalette.coral : OzerPalette.plum)
            .frame(width: 84, height: 84)
            .overlay {
                Image(systemName: speech.isListening ? "waveform" : "mic.fill")
                    .font(.system(size: 30, weight: .semibold))
                    .foregroundStyle(Color.white)
            }
            .shadow(color: OzerPalette.shadow, radius: 12, y: 4)
            .opacity(isSaving ? 0.6 : 1)
            .accessibilityLabel(speech.isListening ? "Stop dictation" : "Start dictation")
            .accessibilityAddTraits(.isButton)
            .accessibilityHint("Hold or tap to dictate a note")
            .accessibilityAction {
                Task {
                    if speech.isListening {
                        await finishAndSave()
                    } else {
                        tapLocked = true
                        await startListening()
                    }
                }
            }
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard !isSaving else { return }
                        if pressStartedAt == nil {
                            pressStartedAt = Date()
                            Task { await handlePressBegan() }
                        }
                    }
                    .onEnded { _ in
                        let started = pressStartedAt
                        pressStartedAt = nil
                        Task { await handlePressEnded(startedAt: started) }
                    }
            )
    }

    private func handlePressBegan() async {
        if tapLocked, speech.isListening {
            return
        }
        await startListening()
    }

    private func handlePressEnded(startedAt: Date?) async {
        guard !isSaving else { return }
        if tapLocked, speech.isListening {
            await finishAndSave()
            return
        }
        let duration = Date().timeIntervalSince(startedAt ?? Date())
        if duration < 0.4, speech.isListening {
            tapLocked = true
            return
        }
        await finishAndSave()
    }

    private func startListening() async {
        guard !speech.isListening, !isStarting else { return }
        isStarting = true
        defer { isStarting = false }
        permissionError = nil
        do {
            try await speech.start()
        } catch {
            permissionError = error.localizedDescription
        }
    }

    private func finishAndSave() async {
        tapLocked = false
        let text = speech.stop()
        guard !text.isEmpty else {
            dismiss()
            return
        }
        isSaving = true
        let title = SpeakerTurnSplitter.title(from: text, fallback: String(text.prefix(80)))
        await onSave(title, text)
        isSaving = false
        dismiss()
    }
}
