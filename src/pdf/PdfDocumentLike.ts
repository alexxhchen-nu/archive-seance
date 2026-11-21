export interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface TextContentLike {
  items: ReadonlyArray<TextItemLike>;
}

/** The slice of a pdf.js PDFDocumentProxy that the text index needs; lets tests pass fakes. */
export interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<TextContentLike> }>;
}
