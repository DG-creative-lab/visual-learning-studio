# 0001 — Domain-centred modular monolith

- Status: accepted for the first prototype
- Date: 2026-09-20

## Context

The first goal is to transform one owner-supplied book PDF into a source-grounded visual episode.
The original source is the workflow input. Synthesis, narrative, script, voice-over, animation, and
video are derived artifacts. Future versions may integrate with Learning Foundry for approved
theory and learning evidence, Human Systems Platform for curated public evidence, model providers
for proposals, voice systems, renderers, and YouTube.

A generic Clean Architecture implementation would create interfaces around internal logic before
the product has demonstrated which boundaries are stable. A collection of scripts would be fast but
would allow source truth, generated narrative, production state, and publication approval to blur.

## Decision

Use one deployable TypeScript application divided into domain modules:

- source;
- editorial;
- production;
- release;
- workflow.

Use ports only for external reads and effects. Keep domain schemas and readiness policies independent
of model, storage, renderer, voice, UI, and publication providers.

The core aggregate is an `EpisodeProject`. It references module-owned records without flattening
their authority:

- a private local binding identifies the source file without entering public contracts;
- an immutable digest binds the episode to the exact inspected source version;
- sources remain authoritative for source content;
- AI output remains a proposal;
- deterministic validation proves structural completeness and provenance;
- the human editor decides narrative fairness and learning value;
- the human owner approves an exact release digest;
- a publication adapter performs and observes the external effect.

## Why this is the smallest coherent design

- One process and one repository keep the prototype easy to run and change.
- Module contracts preserve boundaries needed for later extraction.
- Ports prevent provider choices from entering the domain prematurely.
- Derived readiness avoids a second, mutable status authority.
- Versioned export contracts can be added after a real integration slice.

## Rejected or deferred

- Microservices: no independent scaling, deployment, or team boundary exists.
- A universal media ontology: unnecessary for one episode workflow.
- Podcast reconstruction: a previous generated narration may be compared later, but it is neither
  the workflow input nor evidence about the book.
- Event sourcing for every edit: Learning Foundry already owns its evidence ledger; this prototype
  needs stable artifacts and digest-bound approval first.
- Direct imports from either future parent repository: they would reverse current repository
  boundaries and couple private state to publication work.
- A single generic `Artifact` type: it would erase the different authority of a source, claim,
  script, asset, and approval.

## Extraction rule

A module may become a package or service only after a real vertical slice demonstrates an
independent lifecycle, stable versioned contract, and operational reason for separate ownership.
