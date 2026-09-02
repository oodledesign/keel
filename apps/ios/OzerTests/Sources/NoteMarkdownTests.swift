import Foundation
@testable import OzerNotes

enum NoteMarkdownTests {
    static func run(check: (String, () -> Bool) -> Void) {
        check("round-trips bold italic underline list h1 h2") {
            let source = """
            # Title
            ## Subheading
            Hello **bold** and *italic* and <u>under</u>
            - one
            - two **items**
            """
            let once = NoteMarkdown.roundTrip(source)
            let twice = NoteMarkdown.roundTrip(once)
            let blocks = NoteMarkdown.parse(once)
            twice == once
                && blocks.contains(where: { $0.kind == .heading1 && $0.plainText == "Title" })
                && blocks.contains(where: { $0.kind == .heading2 && $0.plainText == "Subheading" })
                && blocks.contains(where: { block in
                    block.kind == .paragraph
                        && block.runs.contains(where: { $0.bold && $0.text == "bold" })
                        && block.runs.contains(where: { $0.italic && $0.text == "italic" })
                        && block.runs.contains(where: { $0.underline && $0.text == "under" })
                })
                && blocks.filter({ $0.kind == .bullet }).count == 2
        }

        check("nested underline and bold round-trips") {
            let source = "<u>**loud**</u>"
            let blocks = NoteMarkdown.parse(source)
            NoteMarkdown.roundTrip(source) == source
                && blocks.count == 1
                && blocks[0].runs.contains(where: { $0.bold && $0.underline && $0.text == "loud" })
        }

        check("plain transcript lines stay paragraphs") {
            let source = "Me: Hello there\nSpeaker 1: How are you"
            let blocks = NoteMarkdown.parse(source)
            blocks.count == 2
                && blocks.allSatisfy { $0.kind == .paragraph }
                && blocks[0].plainText == "Me: Hello there"
                && blocks[1].plainText == "Speaker 1: How are you"
        }

        check("blank markdown is blank") {
            NoteMarkdown.isBlank("")
                && NoteMarkdown.isBlank("   \n\n")
                && !NoteMarkdown.isBlank("Hello")
        }

        check("plainText strips markers") {
            NoteMarkdown.plainText(from: "# Title\n**bold**") == "Title\nbold"
        }
    }
}
