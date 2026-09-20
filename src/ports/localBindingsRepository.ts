import type { LocalBindings } from '../source/localBindings.js';

export interface LocalBindingsRepository {
  load(path: string): Promise<LocalBindings>;
}
