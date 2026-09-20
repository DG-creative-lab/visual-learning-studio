import type { EpisodeInspection } from './inspectEpisode.js';

export function formatInspection(inspection: EpisodeInspection): string {
  const lines = [
    `Episode: ${inspection.project.title}`,
    `Project ID: ${inspection.project.id}`,
    `Current stage: ${inspection.readiness.currentStage}`,
    `Observed sources: ${Object.keys(inspection.documents).length}/${inspection.project.source.records.length}`,
    '',
    'Sources:',
  ];

  for (const source of inspection.project.source.records) {
    const observation = inspection.documents[source.id];
    lines.push(
      observation === undefined
        ? `- ${source.title}: unavailable`
        : `- ${source.title}: ${observation.pageCount} pages, ${observation.byteSize} bytes, SHA-256 ${observation.contentDigest}`,
    );
  }

  lines.push('', 'Blockers:');

  for (const item of inspection.readiness.blockers) {
    lines.push(`- [${item.gate}] ${item.message} (${item.code})`);
  }

  if (inspection.readiness.blockers.length === 0) {
    lines.push('- none');
  }

  return lines.join('\n');
}
