export interface DocumentObservation {
  readonly contentDigest: string;
  readonly byteSize: number;
  readonly pageCount: number;
  readonly encrypted: boolean;
  readonly format: 'pdf';
}

export interface DocumentProbe {
  inspectPdf(absolutePath: string): Promise<DocumentObservation>;
}
