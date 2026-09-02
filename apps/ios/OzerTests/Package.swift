// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OzerSpeechTests",
    platforms: [
        .macOS(.v13),
        .iOS(.v17),
    ],
    products: [
        .executable(name: "OzerSpeechTests", targets: ["OzerSpeechTests"]),
    ],
    targets: [
        .target(
            name: "OzerSpeech",
            path: "../Ozer/Speech",
            sources: [
                "SpeakerTurnSplitter.swift",
                "SpeakerClustering.swift",
            ]
        ),
        .target(
            name: "OzerNotes",
            path: "../Ozer/Notes",
            sources: [
                "NoteMarkdown.swift",
            ]
        ),
        .executableTarget(
            name: "OzerSpeechTests",
            dependencies: ["OzerSpeech", "OzerNotes"],
            path: "Sources"
        ),
    ]
)
