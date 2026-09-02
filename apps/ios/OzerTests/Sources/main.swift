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
            return live.count == 1
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
            return splitter.turns.count == 1
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
            return splitter.turns.count == 1 && schoolMentions == 1
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
            return splitter.turns.count == 1
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
            return pieces.count == 1
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
            return pieces.count == 2
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
            return labels.count <= SpeakerClustering.maxSpeakers
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
            return labels.count == 2
                && labels.count <= SpeakerClustering.maxSpeakers
                && !labels.contains(where: { $0 >= SpeakerClustering.maxSpeakers })
                && first?.speakerIndex == 0
        }

        check("clustering keeps two voices whose centroids would merge at 0.72") {
            var observations: [SpeakerClustering.Observation] = []
            for index in 0 ..< 8 {
                observations.append(
                    SpeakerClustering.Observation(
                        embedding: perturb(basis(0), index: index, noise: 0.12),
                        start: Double(index) * 2,
                        end: Double(index) * 2 + 1.5
                    )
                )
                observations.append(
                    SpeakerClustering.Observation(
                        embedding: perturb(mixed(0.30), index: index + 20, noise: 0.12),
                        start: Double(index) * 2 + 0.4,
                        end: Double(index) * 2 + 1.8
                    )
                )
            }
            let spans = SpeakerClustering.cluster(observations)
            let labels = Set(spans.map(\.speakerIndex))
            return labels.count == 2 && spans.min(by: { $0.start < $1.start })?.speakerIndex == 0
        }

        check("isRelatedHypothesis catches a Speech rewrite that swaps a word") {
            SpeakerTurnSplitter.isRelatedHypothesis(
                "Is a real of Jesus and it is of sacrifice",
                after: "Is a real of it is his sacrifice"
            )
        }

        check("isRelatedHypothesis catches a rewrite that adds a clause") {
            SpeakerTurnSplitter.isRelatedHypothesis(
                "we've really dealt into all wonder reverence but it's so interesting",
                after: "I know you understand this subject from not the aspect of fear we've really dealt into all wonder reference"
            )
        }

        check("near-duplicate hypotheses collapse to one paragraph") {
            let body = SpeakerTurnSplitter.format(
                turns: [
                    SpeakerTurn(
                        speaker: "Me",
                        text: "Because I don't think I've seen it like this before the Lord confide in those who fear him.",
                        start: 0,
                        end: 4
                    ),
                    SpeakerTurn(
                        speaker: "Me",
                        text: "Because I don't think I've seen it like this before the Lord confide in those who fear him",
                        start: 4.2,
                        end: 7
                    ),
                    SpeakerTurn(
                        speaker: "Me",
                        text: "Is a real of it is his sacrifice",
                        start: 7.1,
                        end: 9
                    ),
                    SpeakerTurn(
                        speaker: "Me",
                        text: "Is a real of Jesus and it is of sacrifice",
                        start: 9.1,
                        end: 11
                    ),
                ],
                liveText: "",
                liveSpeaker: "Me"
            )
            let fearMentions = body.components(separatedBy: "Lord confide").count - 1
            let sacrificeMentions = body.components(separatedBy: "sacrifice").count - 1
            return fearMentions == 1
                && sacrificeMentions == 1
                && body.contains("## Me")
                && !body.contains("\nMe\n")
        }

        check("two-speaker interview stays Me and Speaker 1") {
            var splitter = SpeakerTurnSplitter()
            splitter.ingest(
                sessionText: "Welcome to the show I am glad you could sit with us today.",
                at: 0.2
            )
            splitter.ingest(
                sessionText: "Welcome to the show I am glad you could sit with us today.",
                at: 3.5
            )
            splitter.commitOpen()
            splitter.ingest(
                sessionText: "Worship is my weapon and I know you understand this subject from the aspect of reverence.",
                at: 6
            )
            splitter.ingest(
                sessionText: "Worship is my weapon and I know you understand this subject from the aspect of reverence.",
                at: 11
            )
            splitter.commitOpen()
            splitter.applyDiarization([
                DiarizedSpan(speakerIndex: 0, start: 0, end: 4.5),
                DiarizedSpan(speakerIndex: 1, start: 5.5, end: 12),
            ])
            let body = splitter.formattedBody
            let speakers = Set(splitter.turns.map(\.speaker))
            return speakers == Set(["Me", "Speaker 1"])
                && body.contains("## Me")
                && body.contains("## Speaker 1")
                && body.contains("Welcome to the show")
                && body.contains("Worship is my weapon")
        }

        check("formatted body uses H2 headings and absorbs one-line shards") {
            let body = SpeakerTurnSplitter.format(
                turns: [
                    SpeakerTurn(speaker: "Me", text: "I was", start: 0, end: 0.4),
                    SpeakerTurn(speaker: "Me", text: "25", start: 2.1, end: 2.3),
                    SpeakerTurn(speaker: "Me", text: "Start", start: 4.4, end: 4.6),
                    SpeakerTurn(speaker: "Speaker 1", text: "honour", start: 4.7, end: 5.0),
                    SpeakerTurn(
                        speaker: "Me",
                        text: "going to talk about the fear of the Lord in this room today.",
                        start: 5.2,
                        end: 9
                    ),
                ],
                liveText: "",
                liveSpeaker: "Me"
            )
            let lines = body.split(whereSeparator: \.isNewline).map(String.init)
            let oneWordLines = lines.filter { $0 == "25" || $0 == "Start" || $0 == "I was" || $0 == "honour" }
            return body.contains("## Me")
                && !body.contains("## Speaker")
                && body.contains("fear of the Lord")
                && oneWordLines.isEmpty
                && !body.contains("\nMe\n")
        }

        check("complete sentences with a real pause stay separate paragraphs") {
            let body = SpeakerTurnSplitter.format(
                turns: [
                    SpeakerTurn(speaker: "Me", text: "Welcome to the show.", start: 0, end: 2),
                    SpeakerTurn(speaker: "Me", text: "Today we talk about reverence.", start: 5, end: 8),
                ],
                liveText: "",
                liveSpeaker: "Me"
            )
            return body.contains("## Me")
                && body.contains("Welcome to the show.\n\nToday we talk about reverence.")
                && SpeakerTurnSplitter.parseTurns(from: body).count == 1
                && SpeakerTurnSplitter.parseTurns(from: body)[0].speaker == "Me"
        }

        check("parseTurns reads markdown H2 and legacy plain labels") {
            let modern = SpeakerTurnSplitter.parseTurns(
                from: "## Me\n\nWelcome to the show\n\n## Speaker 1\n\nWorship is my weapon"
            )
            let legacy = SpeakerTurnSplitter.parseTurns(
                from: "Me\n\nWelcome to the show\n\nSpeaker 1\n\nWorship is my weapon"
            )
            return modern.map(\.speaker) == ["Me", "Speaker 1"]
                && legacy.map(\.speaker) == ["Me", "Speaker 1"]
                && modern[0].text.contains("Welcome")
                && SpeakerTurnSplitter.title(from: "## Me\n\nWelcome to the show", fallback: "Meeting")
                == "Welcome to the show"
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

    static func perturb(_ base: [Float], index: Int, noise: Float = 0.55) -> [Float] {
        var vector = base
        let dim = 2 + (index % max(1, vector.count - 2))
        vector[dim] += noise * Float((index % 7) + 1) / 7
        let magnitude = sqrt(vector.reduce(Float(0)) { $0 + $1 * $1 })
        return vector.map { $0 / max(magnitude, 0.0001) }
    }

    static func mixed(_ similarity: Float, dim: Int = 16) -> [Float] {
        var vector = [Float](repeating: 0, count: dim)
        vector[0] = similarity
        vector[1] = sqrt(max(0, 1 - similarity * similarity))
        return vector
    }
}
