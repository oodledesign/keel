import AVFoundation
import SwiftUI

struct MeetingDetailView: View {
    let meeting: LocalMeeting

    @Environment(AppSession.self) private var session
    @State private var player: AVAudioPlayer?
    @State private var isPlaying = false
    @State private var confirmDelete = false
    @State private var playback = MeetingAudioPlayback()

    private var current: LocalMeeting {
        MeetingStore.shared.meeting(id: meeting.id) ?? meeting
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(current.title)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(OzerPalette.plum)
                    Text("\(current.durationLabel) · \(NoteItem.relativeDateLabel(current.createdAt) ?? "Just now")")
                        .font(.subheadline)
                        .foregroundStyle(OzerPalette.plumMuted)
                    if let clientName = current.clientName, !clientName.isEmpty {
                        Text(clientName)
                            .font(.subheadline)
                            .foregroundStyle(OzerPalette.plumMuted)
                    }
                    if current.isWaitingToSync {
                        Text("Waiting to sync")
                            .font(.caption)
                            .foregroundStyle(OzerPalette.plumSoft)
                    }
                }

                if current.audioURL != nil {
                    Button {
                        togglePlayback()
                    } label: {
                        Label(isPlaying ? "Pause audio" : "Play audio", systemImage: isPlaying ? "pause.fill" : "play.fill")
                            .font(.body.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                    }
                    .buttonStyle(OzerPrimaryButtonStyle())
                }

                SpeakerTranscriptView(turns: current.displayTurns)
            }
            .padding(16)
            .background(OzerPalette.panel, in: RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: OzerRadius.card, style: .continuous)
                    .stroke(OzerPalette.border, lineWidth: 1)
            }
            .padding(.top, 8)

            Button(role: .destructive) {
                confirmDelete = true
            } label: {
                Text("Delete from this iPhone")
                    .font(.body.weight(.medium))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(OzerSecondaryButtonStyle())
            .padding(.top, 8)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 88)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OzerPalette.cream.ignoresSafeArea())
        .navigationTitle("Meeting")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Delete this meeting from the phone? The audio is removed. A synced note stays in Notes.", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                stopPlayback()
                MeetingStore.shared.delete(id: current.id)
            }
        }
        .onDisappear {
            stopPlayback()
        }
    }

    private func togglePlayback() {
        if isPlaying {
            stopPlayback()
            return
        }
        guard let url = current.audioURL else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback)
            try AVAudioSession.sharedInstance().setActive(true)
            let next = try AVAudioPlayer(contentsOf: url)
            playback.onFinish = {
                isPlaying = false
                player = nil
            }
            next.delegate = playback
            next.play()
            player = next
            isPlaying = true
        } catch {
            isPlaying = false
        }
    }

    private func stopPlayback() {
        player?.stop()
        player = nil
        isPlaying = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

final class MeetingAudioPlayback: NSObject, AVAudioPlayerDelegate {
    var onFinish: (() -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.onFinish?()
        }
    }
}
