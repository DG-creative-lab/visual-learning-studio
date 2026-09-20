import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EpisodeRepository, LoadedEpisodeProject } from '../ports/episodeRepository.js';
import { episodeProjectSchema } from '../workflow/project.js';

export class JsonEpisodeRepository implements EpisodeRepository {
  async load(manifestPath: string): Promise<LoadedEpisodeProject> {
    const absoluteManifestPath = path.resolve(manifestPath);
    const contents = await readFile(absoluteManifestPath, 'utf8');
    const project = episodeProjectSchema.parse(JSON.parse(contents));

    return {
      project,
      manifestPath: absoluteManifestPath,
      directory: path.dirname(absoluteManifestPath),
    };
  }
}
