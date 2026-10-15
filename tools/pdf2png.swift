// PDF-Seiten als PNG (PDFKit), zum Prüfen des PDF-Exports: swift tools/pdf2png.swift datei.pdf zielordner [breite]
import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments
guard args.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else { print("usage: pdf2png in.pdf outdir [width]"); exit(1) }
let out = URL(fileURLWithPath: args[2]); try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let W = args.count > 3 ? CGFloat(Double(args[3]) ?? 1600) : 1600
for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let r = page.bounds(for: .mediaBox); let s = W / r.width
  let size = NSSize(width: r.width * s, height: r.height * s)
  let img = page.thumbnail(of: size, for: .mediaBox)
  guard let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else { continue }
  try? png.write(to: out.appendingPathComponent(String(format: "p%02d.png", i + 1)))
}
print("pages:", doc.pageCount)
