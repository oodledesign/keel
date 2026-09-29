import {
  type PDFDocument,
  PDFHexString,
  PDFName,
  type PDFPage,
  type PDFRef,
  PDFString,
} from 'pdf-lib';

export type PdfRect = { x: number; y: number; width: number; height: number };

export type PdfOutlineEntry = {
  title: string;
  page: PDFPage;
  children?: PdfOutlineEntry[];
};

function rectArray(box: PdfRect) {
  return [box.x, box.y, box.x + box.width, box.y + box.height];
}

function pageDestination(page: PDFPage) {
  return [page.ref, 'XYZ', null, null, null];
}

/** Adds a clickable area that opens an external URL. */
export function addUriLink(page: PDFPage, box: PdfRect, url: string) {
  const annot = page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rectArray(box),
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  });
  page.node.addAnnot(page.doc.context.register(annot));
}

/** Adds a clickable area that jumps to another page in the same document. */
export function addInternalLink(page: PDFPage, box: PdfRect, target: PDFPage) {
  const annot = page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rectArray(box),
    Border: [0, 0, 0],
    Dest: pageDestination(target),
  });
  page.node.addAnnot(page.doc.context.register(annot));
}

function writeOutlineLevel(
  doc: PDFDocument,
  entries: PdfOutlineEntry[],
  parent: PDFRef,
): { first: PDFRef; last: PDFRef; count: number } | null {
  if (entries.length === 0) return null;
  const { context } = doc;
  const refs = entries.map(() => context.nextRef());

  entries.forEach((entry, index) => {
    const dict = context.obj({
      Title: PDFHexString.fromText(entry.title),
      Parent: parent,
      Dest: pageDestination(entry.page),
    });
    if (index > 0) dict.set(PDFName.of('Prev'), refs[index - 1]!);
    if (index < refs.length - 1) dict.set(PDFName.of('Next'), refs[index + 1]!);

    const children = writeOutlineLevel(doc, entry.children ?? [], refs[index]!);
    if (children) {
      dict.set(PDFName.of('First'), children.first);
      dict.set(PDFName.of('Last'), children.last);
      dict.set(PDFName.of('Count'), context.obj(-children.count));
    }
    context.assign(refs[index]!, dict);
  });

  return { first: refs[0]!, last: refs[refs.length - 1]!, count: refs.length };
}

/** Writes the bookmark panel (document outline); child entries start collapsed. */
export function buildOutline(doc: PDFDocument, entries: PdfOutlineEntry[]) {
  const outlinesRef = doc.context.nextRef();
  const top = writeOutlineLevel(doc, entries, outlinesRef);
  if (!top) return;
  doc.context.assign(
    outlinesRef,
    doc.context.obj({
      Type: 'Outlines',
      First: top.first,
      Last: top.last,
      Count: top.count,
    }),
  );
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
}
