import { describe, expect, it } from 'vitest';
import { claimRecordSchema, sourceCoverageSchema } from '../src/source/contracts.js';
import { localBindingsSchema } from '../src/source/localBindings.js';

describe('authority-bearing contracts', () => {
  it('does not certify a declared selection without naming the selected sections', () => {
    const result = sourceCoverageSchema.safeParse({
      scope: 'declared_selection',
      mode: 'full',
      inspected: 'The declared scope was reviewed.',
      selectedSections: [],
      exclusions: ['The rest of the book.'],
    });

    expect(result.success).toBe(false);
  });

  it('accepts complete coverage when the bounded selection is explicit', () => {
    const result = sourceCoverageSchema.safeParse({
      scope: 'declared_selection',
      mode: 'full',
      inspected: 'Every selected section was synthesized and checked.',
      selectedSections: [
        {
          locator: 'Chapter 1, pages 1-24',
          rationale: 'Defines the model used by the episode.',
        },
      ],
      exclusions: ['Chapters unrelated to the episode question.'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a locator that silently substitutes another registered source', () => {
    const result = claimRecordSchema.safeParse({
      id: 'claim.source-substitution',
      statement: 'A material source claim.',
      epistemicKind: 'source_claim',
      status: 'verified',
      sourceIds: ['source.declared'],
      locators: [
        {
          sourceId: 'source.substituted',
          locator: 'Chapter 3, page 42',
        },
      ],
      reviewNote: 'The locator points to a different source identity.',
    });

    expect(result.success).toBe(false);
  });

  it('requires an exact locator for every source declared by a source-grounded claim', () => {
    const result = claimRecordSchema.safeParse({
      id: 'claim.partial-provenance',
      statement: 'A synthesis that attributes support to two sources.',
      epistemicKind: 'source_claim',
      status: 'verified',
      sourceIds: ['source.first', 'source.second'],
      locators: [
        {
          sourceId: 'source.first',
          locator: 'Chapter 1, page 12',
        },
      ],
      reviewNote: 'The second declared source has no locator.',
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate private bindings instead of silently taking the last path', () => {
    const result = localBindingsSchema.safeParse({
      schemaVersion: 'visual-learning.local-source-bindings/v1',
      sources: [
        { sourceId: 'source.example', path: 'first.pdf' },
        { sourceId: 'source.example', path: 'substituted.pdf' },
      ],
    });

    expect(result.success).toBe(false);
  });
});
