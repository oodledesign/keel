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
        .target(
            name: "OzerMeetings",
            path: "../Ozer/Meetings",
            sources: [
                "MeetingDisplay.swift",
            ]
        ),
        .target(
            name: "OzerFinance",
            path: "../Ozer/Network",
            sources: [
                "NativeFinanceModels.swift",
            ]
        ),
        .target(
            name: "OzerWorkspace",
            path: "../Ozer",
            sources: [
                "App/AppScreen.swift",
                "App/ContentLoadPhase.swift",
                "Workspace/WorkspaceNavigation.swift",
            ]
        ),
        .target(
            name: "OzerMemories",
            path: "../Ozer/Memories",
            sources: [
                "MemoryDisplay.swift",
                "MemoryMedia.swift",
            ]
        ),
        .target(
            name: "OzerSurveys",
            path: "../Ozer/Surveys",
            sources: [
                "SurveyDisplay.swift",
                "SurveySectionCatalogue.swift",
                "SurveyPhotoSync.swift",
                "SurveyAddress.swift",
            ]
        ),
        .executableTarget(
            name: "OzerSpeechTests",
            dependencies: ["OzerSpeech", "OzerNotes", "OzerMeetings", "OzerFinance", "OzerWorkspace", "OzerSurveys", "OzerMemories"],
            path: "Sources"
        ),
    ]
)
