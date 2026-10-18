/** Future adapter contract only. No statement parser, file upload, bank API or categorization runs in the MVP. */
export interface ImportCandidate {
  externalId: string;
  date: string;
  description: string;
  signedCents: number;
  accountId: string;
  suggestedCategory?: string;
  source: string;
}
export interface StatementParser {
  format: string;
  parse(
    input: Uint8Array,
  ): Promise<{ candidates: ImportCandidate[]; warnings: string[] }>;
}
export interface ImportPreview {
  fingerprint: string;
  duplicates: number;
  candidates: ImportCandidate[];
  errors: { row: number; message: string }[];
}
