#!/usr/bin/env node
import { JsonLocalBindingsRepository } from './adapters/jsonLocalBindingsRepository.js';
import { JsonEpisodeRepository } from './adapters/jsonEpisodeRepository.js';
import { FileArtifactProbe } from './adapters/fileArtifactProbe.js';
import { PdfInfoDocumentProbe } from './adapters/pdfInfoDocumentProbe.js';
import { formatInspection } from './application/formatInspection.js';
import { inspectEpisode } from './application/inspectEpisode.js';

async function main(): Promise<void> {
  const [command, manifestPath, bindingsPath] = process.argv.slice(2);

  if (command !== 'inspect' || manifestPath === undefined || bindingsPath === undefined) {
    throw new Error(
      'Usage: visual-learning-studio inspect <episode-manifest.json> <local-bindings.json>',
    );
  }

  const inspection = await inspectEpisode(manifestPath, bindingsPath, {
    episodes: new JsonEpisodeRepository(),
    bindings: new JsonLocalBindingsRepository(),
    documents: new PdfInfoDocumentProbe(),
    artifacts: new FileArtifactProbe(),
  });

  process.stdout.write(`${formatInspection(inspection)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Visual Learning Studio failed: ${message}\n`);
  process.exitCode = 1;
});
