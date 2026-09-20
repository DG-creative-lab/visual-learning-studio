import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { DocumentObservation, DocumentProbe } from '../ports/documentProbe.js';

const execFileAsync = promisify(execFile);

function valueFor(output: string, label: string): string | undefined {
  const line = output.split('\n').find((candidate) => candidate.startsWith(`${label}:`));
  return line?.slice(label.length + 1).trim();
}

export class PdfInfoDocumentProbe implements DocumentProbe {
  async inspectPdf(absolutePath: string): Promise<DocumentObservation> {
    const [{ stdout }, bytes, file] = await Promise.all([
      execFileAsync('pdfinfo', [absolutePath]),
      readFile(absolutePath),
      stat(absolutePath),
    ]);
    const pageCount = Number(valueFor(stdout, 'Pages'));

    if (!Number.isInteger(pageCount) || pageCount <= 0) {
      throw new Error('pdfinfo did not return a positive page count.');
    }

    return {
      contentDigest: createHash('sha256').update(bytes).digest('hex'),
      byteSize: file.size,
      pageCount,
      encrypted: valueFor(stdout, 'Encrypted') === 'yes',
      format: 'pdf',
    };
  }
}
