import type { EpisodeProject } from '../workflow/project.js';

export interface LoadedEpisodeProject {
  readonly project: EpisodeProject;
  readonly manifestPath: string;
  readonly directory: string;
}

export interface EpisodeRepository {
  load(manifestPath: string): Promise<LoadedEpisodeProject>;
}
