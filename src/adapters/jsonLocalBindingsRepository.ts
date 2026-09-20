import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalBindingsRepository } from '../ports/localBindingsRepository.js';
import { localBindingsSchema, type LocalBindings } from '../source/localBindings.js';

export class JsonLocalBindingsRepository implements LocalBindingsRepository {
  async load(bindingsPath: string): Promise<LocalBindings> {
    const absolutePath = path.resolve(bindingsPath);
    const contents = await readFile(absolutePath, 'utf8');
    return localBindingsSchema.parse(JSON.parse(contents));
  }
}
