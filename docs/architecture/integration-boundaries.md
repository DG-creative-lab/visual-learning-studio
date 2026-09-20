# Integration boundaries

## Learning Foundry

Learning Foundry is the likely future authority for approved source fragments, Living Theory, and
human-learning evidence. Visual Learning Studio should consume an explicitly selected projection,
never raw JSONL, private responses, local paths, model context, or unrestricted memory.

Proposed future input:

```text
visual-learning.approved-theory-candidate/v1
  selected source identities and versions
  bounded source locators
  active theory elements and relationships
  epistemic kinds
  limitations, contradictions, and unresolved questions
  explicit privacy exclusions
  preparation and owner-review identity
```

The adapter may map this candidate into source and claim records. It cannot approve an episode,
select a public narrative, or authorize publication.

## Human Systems Platform

The platform already accepts curated Learning Foundry public-evidence candidates through a
deterministic adapter while keeping the private ledger external. Visual Learning Studio should
follow the same pattern.

Proposed future output:

```text
visual-learning.public-episode-evidence-candidate/v1
  stable episode and release identities
  bounded public source references
  public claim and limitation summaries
  learning objective and visual relationship summary
  owner-approved release digest
  observed publication identity
  correction and viewer-learning observations
  explicit privacy exclusions
```

This output is evidence eligible for separate platform review. It is not a profile claim,
publication approval, signature, or proof of human competence.

## Compatibility rules

- Contracts are JSON-compatible and runtime validated.
- Schema names are namespaced and versioned.
- Unknown schema versions fail visibly.
- Source, episode, claim, script, scene, release, and observation identities remain distinct.
- Filesystem paths never cross a public adapter.
- Public summaries do not carry full source text, raw learner responses, or private model context.
- A later package extraction must preserve these semantics rather than merely preserve field names.
