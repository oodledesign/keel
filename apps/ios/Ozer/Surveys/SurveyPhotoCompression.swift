import UIKit

enum SurveyPhotoCompression {
    /// Compress a report-bound copy. Callers should keep `data` as the local archive original.
    static func uploadJPEG(from data: Data) -> Data {
        guard let image = UIImage(data: data) else { return data }
        return uploadJPEG(from: image) ?? data
    }

    static func uploadJPEG(from image: UIImage) -> Data? {
        let scaled = scale(image, maxPixelSize: SurveyPhotoSync.maxUploadPixelSize)
        return scaled.jpegData(compressionQuality: CGFloat(SurveyPhotoSync.uploadJpegQuality))
    }

    static func scale(_ image: UIImage, maxPixelSize: Int) -> UIImage {
        let width = image.size.width * image.scale
        let height = image.size.height * image.scale
        let longest = max(width, height)
        guard longest > CGFloat(maxPixelSize), longest > 0 else { return image }

        let ratio = CGFloat(maxPixelSize) / longest
        let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
