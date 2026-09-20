# Visual Learning Studio agent instructions

## Purpose

Build a source-to-episode production system. The original approved book, paper, or report is the
canonical input. The product succeeds when a viewer can reconstruct an important model, distinguish
source claims from editorial interpretation, and make a better decision about reading or applying
the original source.

## Architectural rules

- Keep this repository an independent modular monolith until a real integration slice proves stable
  boundaries.
- Sources remain authoritative for what they say. Generated synthesis, scripts, and visuals are
  proposals.
- Distribution promises and hooks must be supported by registered episode claims. Engagement
  metrics may inform hypotheses but never become authority for truth or publication.
- Treat transcripts, voice-over, audio, animation, and video as downstream artifacts. Never use an
  earlier generated podcast as source evidence.
- Keep source facts, evidence, editorial interpretation, limitations, and unknowns distinct.
- Put rules in domain modules, orchestration in `application`, and external effects behind `ports`.
- Add a port only for a real external boundary. Do not wrap pure functions or internal modules in
  interfaces.
- Publication requires a human approval bound to the exact release digest.
- Monetizable output must remain recognizably original: synthesis, application, narrative, and
  visual explanation cannot collapse into automated readings or interchangeable templates.
- Do not import private Learning Foundry ledgers or Human Systems Platform internals.
- Keep copyrighted source files and local filesystem bindings outside any public repository.
- Integration uses small, versioned, runtime-neutral contracts with explicit privacy boundaries.
- Unknown, incomplete, unsupported, and unverified states must remain visible.

## Verification

Run `pnpm check` after changes. Add contract and workflow tests for new lifecycle transitions or
authority rules.
