import CoreTransferable
import UniformTypeIdentifiers

struct MemoryImageTransfer: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .image) { data in
            MemoryImageTransfer(data: data)
        }
        DataRepresentation(importedContentType: .jpeg) { data in
            MemoryImageTransfer(data: data)
        }
        DataRepresentation(importedContentType: .png) { data in
            MemoryImageTransfer(data: data)
        }
        DataRepresentation(importedContentType: .heic) { data in
            MemoryImageTransfer(data: data)
        }
    }
}

struct MemoryMovieTransfer: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .movie) { data in
            MemoryMovieTransfer(data: data)
        }
        DataRepresentation(importedContentType: .mpeg4Movie) { data in
            MemoryMovieTransfer(data: data)
        }
        DataRepresentation(importedContentType: .quickTimeMovie) { data in
            MemoryMovieTransfer(data: data)
        }
    }
}

struct MemoryAudioTransfer: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(importedContentType: .audio) { data in
            MemoryAudioTransfer(data: data)
        }
        DataRepresentation(importedContentType: .mpeg4Audio) { data in
            MemoryAudioTransfer(data: data)
        }
        DataRepresentation(importedContentType: .wav) { data in
            MemoryAudioTransfer(data: data)
        }
        DataRepresentation(importedContentType: .mp3) { data in
            MemoryAudioTransfer(data: data)
        }
    }
}
