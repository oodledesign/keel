import Foundation
@testable import OzerSpeech

@main
struct SpeakerTranscriptTests {
    static func main() {
        var failed = 0

        func check(_ name: String, _ body: () -> Bool) {
            if body() {
                print("PASS \(name)")
            } else {
                print("FAIL \(name)")
                failed += 1
            }
        }

        check("isRedundant when prev is prefix of next") {
            SpeakerTurnSplitter.isRedundant(
                "It's very much like the school only shower this is horrible",
                after: "It's very much like the school only shower"
            )
        }

        check("isRedundant when next is prefix of prev") {
            SpeakerTurnSplitter.isRedundant(
                "It's very much like the school",
                after: "It's very much like the school only shower"
            )
        }

        check("isRedundant is false for a continuation after a shared tail") {
            !SpeakerTurnSplitter.isRedundant(
                "and I will go to the store after lunch",
                after: "I think we should wrap this up and I will go"
            )
        }

        check("growing hypothesis updates live turn in place") {
            var splitter = SpeakerTurnSplitter()
            splitter.ingest(sessionText: "It's very much like the school", at: 1)
            splitter.ingest(sessionText: "It's very much like the school only shower", at: 1.4)
            let live = splitter.displayTurns
            live.count == 1
                && live[0].id == SpeakerTurnSplitter.liveTurnID
                && splitter.turns.isEmpty
                && live[0].text.contains("only shower")
        }

        check("growing hypothesis updates last committed turn, does not duplicate") {
            var splitter = SpeakerTurnSplitter()
            splitter.ingest(sessionText: "It's very much like the school only shower", at: 1)
            splitter.commitOpen()
            splitter.ingest(
                sessionText: "It's very much like the school her only shower this is horrible.",
                at: 4
            )
            let body = splitter.finish()
            splitter.turns.count == 1
                && body.contains("this is horrible")
                && body.components(separatedBy: "this is horrible").count == 2
        }

        check("shrink then new hypothesis does not re-append a near-duplicate") {
            var splitter = SpeakerTurnSplitter()
            splitter.ingest(
                sessionText: "It's very much like the school only shower this is horrible",
                at: 1
            )
            splitter.commitOpen()
            splitter.ingest(sessionText: "her only shower this is horrible", at: 2.2)
            splitter.ingest(
                sessionText: "It's very much like the school her only shower this is horrible",
                at: 3
            )
            let body = splitter.finish()
            let schoolMentions = body.components(separatedBy: "very much like the school").count - 1
            splitter.turns.count == 1 && schoolMentions == 1
        }

        check("applyDiarization overlapping spans yield one majority speaker") {
            var splitter = SpeakerTurnSplitter()
            splitter.ingest(
                sessionText: "And I've got a roof and I've got water for the garden now",
                at: 0
            )
            splitter.ingest(
                sessionText: "And I've got a roof and I've got water for the garden now thanks",
                at: 10
            )
            splitter.commitOpen()
            splitter.applyDiarization([
                DiarizedSpan(speakerIndex: 0, start: 0, end: 10),
                DiarizedSpan(speakerIndex: 1, start: 1, end: 9),
                DiarizedSpan(speakerIndex: 4, start: 2, end: 8),
                DiarizedSpan(speakerIndex: 7, start: 3, end: 12),
            ])
            let body = splitter.formattedBody
            splitter.turns.count == 1
                && splitter.turns[0].speaker == "Me"
                && !body.contains("Speaker")
                && !splitter.turns[0].text.contains("ve got water for water")
        }

        check("splitTurn overlapping spans do not character-slice fragments") {
            let turn = SpeakerTurn(
                speaker: "Me",
                text: "And I've got a roof and I've got water for the garden",
                start: 0,
                end: 10
            )
            let pieces = SpeakerTurnSplitter.splitTurn(
                turn,
                spans: [
                    DiarizedSpan(speakerIndex: 0, start: 0, end: 10),
                    DiarizedSpan(speakerIndex: 1, start: 2, end: 11),
                    DiarizedSpan(speakerIndex: 2, start: 1, end: 8),
                ]
            )
            pieces.count == 1
                && pieces[0].speaker == "Me"
                && pieces[0].text == turn.text
        }

        check("splitTurn uses word boundary when both speakers last at least one second") {
            let turn = SpeakerTurn(
                speaker: "Me",
                text: "Hello there everyone. Thanks for coming in today.",
                start: 0,
                end: 10
            )
            let pieces = SpeakerTurnSplitter.splitTurn(
                turn,
                spans: [
                    DiarizedSpan(speakerIndex: 0, start: 0, end: 5),
                    DiarizedSpan(speakerIndex: 1, start: 5, end: 10),
                ]
            )
            pieces.count == 2
                && pieces[0].speaker == "Me"
                && pieces[1].speaker == "Speaker 1"
                && pieces[0].text.contains("everyone")
                && !pieces[0].text.contains("coming")
                && pieces.allSatisfy { !$0.text.contains(" ") || $0.text.split(separator: " ").count >= 2 }
        }

        check("clustering caps 20 distant voices at six labels, first is Me") {
            var observations: [SpeakerClustering.Observation] = []
            for index in 0 ..< 20 {
                var vector = [Float](repeating: 0, count: 20)
                vector[index] = 1
                observations.append(
                    SpeakerClustering.Observation(
                        embedding: vector,
                        start: Double(index) * 2,
                        end: Double(index) * 2 + 1
                    )
                )
            }
            let spans = SpeakerClustering.cluster(observations)
            let labels = Set(spans.map(\.speakerIndex))
            labels.count <= SpeakerClustering.maxSpeakers
                && labels.count == SpeakerClustering.maxSpeakers
                && spans.min(by: { $0.start < $1.start })?.speakerIndex == 0
        }

        check("clustering 20 noisy observations of 2 speakers stays at 2, first is Me") {
            var observations: [SpeakerClustering.Observation] = []
            for index in 0 ..< 10 {
                observations.append(
                    SpeakerClustering.Observation(
                        embedding: perturb(basis(0), index: index),
                        start: Double(index),
                        end: Double(index) + 1.6
                    )
                )
            }
            for index in 0 ..< 10 {
                observations.append(
                    SpeakerClustering.Observation(
                        embedding: perturb(basis(1), index: index + 40),
                        start: Double(index) + 0.3,
                        end: Double(index) + 1.8
                    )
                )
            }
            let spans = SpeakerClustering.cluster(observations)
            let labels = Set(spans.map(\.speakerIndex))
            let first = spans.min(by: { $0.start < $1.start })
            labels.count == 2
                && labels.count <= SpeakerClustering.maxSpeakers
                && !labels.contains(where: { $0 >= SpeakerClustering.maxSpeakers })
                && first?.speakerIndex == 0
        }

        if failed > 0 {
            fputs("\(failed) test(s) failed\n", stderr)
            exit(1)
        }
        print("All tests passed")
    }

    static func basis(_ axis: Int, dim: Int = 16) -> [Float] {
        var vector = [Float](repeating: 0, count: dim)
        vector[axis] = 1
        return vector
    }

    static func perturb(_ base: [Float], index: Int) -> [Float] {
        var vector = base
        let dim = 2 + (index % max(1, vector.count - 2))
        vector[dim] += 0.55 * Float((index % 7) + 1) / 7
        let magnitude = sqrt(vector.reduce(Float(0)) { $0 + $1 * $1 })
        return vector.map { $0 / max(magnitude, 0.0001) }
    }
}
