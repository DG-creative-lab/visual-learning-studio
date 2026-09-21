# Visual Learning Studio

Visual Learning Studio is a source-grounded production pipeline for turning approved books,
papers, and reports into narrated visual learning episodes designed for comprehension, discovery,
and sustainable publication.

The pipeline begins with the original source. A podcast, transcript, script, voice-over, animation,
and YouTube video are downstream artifacts. None of them may replace the book or paper as authority
for what the source says.

## First prototype

The first episode is a bounded thematic synthesis:

**_Beyond Functionality: What Makes an AI Product Feel Good to Use?_**

It asks how an AI product becomes understandable, useful for a real goal, and worth returning to.
The working model is **Understand → Accomplish → Care**, grounded in:

- Donald A. Norman, _The Design of Everyday Things_, Currency edition with the 2002 preface;
- Alan Cooper, Robert Reimann, David Cronin, and Christopher Noessel, _About Face: The
  Essentials of Interaction Design_, fourth edition, Wiley, 2014; and
- Donald A. Norman, _Emotional Design_, Basic Books, 2004.

The episode is not presented as a complete summary of all three books. Its source records must name
the selected coverage and exclusions before synthesis begins.

The local path is held in an ignored private binding. The open-source project can contain source
identity, provenance, and bounded locators without redistributing the copyrighted PDF or exposing a
personal filesystem path.

## Product outcome

An episode should help a product designer or AI engineer:

1. reconstruct the source's central model;
2. distinguish evidence, source argument, editorial interpretation, limitation, and uncertainty;
3. apply the model to an AI-product decision; and
4. decide whether the original source deserves deeper reading.

## Source-to-episode workflow

```text
approved book or paper
  -> immutable source identity and local binding
  -> extraction and structure map
  -> chapter or section unit records
  -> recursive source synthesis
  -> verified claims, evidence, limitations, and unknowns
  -> audience-specific learning objective
  -> narrative beats
  -> truthful title, thumbnail, and opening-hook candidates
  -> narration script
  -> claim and coverage verification
  -> scene plan and visual grammar
  -> voice-over generation or recording
  -> doodle assets and animation
  -> captions, references, disclosure, and source page
  -> deterministic render
  -> derivative plan for source page, Shorts, and other selected formats
  -> exact release digest and human approval
  -> private platform check
  -> publication
  -> comprehension, retention, correction, and production feedback
```

The source synthesis and the public narrative are separate artifacts. Coverage may target a whole
source or an explicitly declared selection. In both cases, `full` means complete against that
declared scope, with exclusions visible. The episode then selects one coherent path through that
knowledge for a particular audience and learning objective.

## Architectural decision

Use a domain-centred modular monolith with a thin application layer and ports only at external
effects.

The distinctive core is **verified episode production**. This is not a generic media pipeline:
source provenance, epistemic labels, audience learning, visual purpose, and exact release approval
belong to the domain.

| Module         | Responsibility                                                              | Authority                                                        |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `source`       | Local bindings, immutable source versions, coverage, locators, and claims   | The original source attests what it contains                     |
| `editorial`    | Audience, learning objective, narrative beats, and script proposals         | The human editor approves meaning and fairness                   |
| `distribution` | Audience promise, truthful packaging candidates, and derivative plans       | Verified claims constrain promises; the editor selects packaging |
| `production`   | Voice plan, audio artifact, scenes, assets, and render plan                 | Observed artifacts attest production outputs                     |
| `release`      | Exact publication package, digest-bound review, and publication observation | The human owner authorizes public release                        |
| `workflow`     | Derive readiness and explain blockers across modules                        | No independent content authority                                 |

External systems sit behind ports: document inspection, extraction, model-assisted proposals, voice
generation, video rendering, storage, and publication.

### The Architecture

Internal pure functions do not need interfaces. Ports exist where a provider, filesystem, model,
renderer, or publishing platform can change or produce an external effect. The domain modules keep
their own language rather than sharing a universal `Artifact` abstraction that would erase the
difference between a source, claim, script, asset, and approval.

## Authority model

| Artifact or decision              | May be proposed by         | Must be verified or approved by                        |
| --------------------------------- | -------------------------- | ------------------------------------------------------ |
| Source identity and version       | Import workflow            | Document observation and content digest                |
| Source structure and unit records | Reading agent              | Coverage check against the original source             |
| Claim and locator                 | Reading or editorial agent | Original source at the declared location               |
| Narrative and script              | Editorial agent            | Human editor plus deterministic provenance checks      |
| Visual scene                      | Storyboard agent           | Human editor for learning purpose and source fairness  |
| Voice and video files             | Production adapter         | Content digest and production quality checks           |
| Public release                    | Release workflow           | Human approval bound to the exact candidate digest     |
| Publication success               | Publisher adapter          | Observation of the final URL, visibility, and playback |

Model confidence cannot turn an interpretation into a source fact. A successful render cannot
authorize publication. A YouTube upload response cannot prove that the correct video is public.

## Current vertical slice

The CLI currently:

1. loads the episode manifest;
2. loads a private local source binding;
3. inspects the PDF using `pdfinfo`;
4. recomputes its SHA-256 digest;
5. confirms page count, encryption state, and source identity;
6. derives the furthest safe workflow stage; and
7. explains every missing requirement for later stages.

```bash
pnpm install
pnpm prototype
pnpm check
```

Local inspection and verification require `pdfinfo`, `ffmpeg`, and `ffprobe` on `PATH`. Media
artifacts are accepted only when `ffprobe` finds the expected stream with positive duration and a
bounded `ffmpeg -xerror` pass decodes the complete payload. Caption files are parsed by FFmpeg's
WebVTT or SRT demuxer through a bounded streaming decode and must produce at least one
positive-duration cue with viewer-visible text.

Pull requests run the same complete gate used locally:

```bash
make ci
```

The gate installs the locked dependency graph, checks formatting, type-checks, runs the
invariant-focused test suite, and verifies the production build.

The expected current state is `sources_ready`. The three exact PDFs have been identified and
observed, but only preflight inspection has been performed. Selected-section coverage, claims,
narrative, packaging, script, scenes, generated voice-over, render, and release approval are
deliberately absent.

## Repository map

```text
visual-learning-studio/
  docs/architecture/          decisions and integration boundaries
  episodes/
    pretty-things/
      episode.json            public-safe episode identity and authored records
      private/                ignored local paths and future private working material
  src/
    source/                   source, provenance, claim, and local-binding contracts
    editorial/                learning objective, narrative, and script contracts
    distribution/             audience promise, packaging, and derivative contracts
    production/               voice, audio, scene, asset, and render contracts
    release/                  release, approval, and digest rules
    workflow/                 lifecycle readiness
    application/              use cases
    ports/                    external capabilities
    adapters/                 local implementations
  tests/                      contract and composed-workflow evidence
```

## Lifecycle

```text
registered
  -> sources_ready
  -> synthesis_ready
  -> narrative_ready
  -> packaging_ready
  -> script_verified
  -> scenes_ready
  -> production_ready
  -> release_approved
  -> published
```

Readiness is derived from actual records and observations. A stored status label cannot grant
authority or hide incomplete work.

## Distribution and sustainable publication

Distribution starts with the episode brief, not after rendering. Each episode records a precise
audience promise, at least three claim-supported title/thumbnail/hook candidates, one human-selected
package, and only the derivative formats that have a real purpose.

The system does not claim to predict a platform algorithm. A later analytics adapter may observe
appeal, engagement, satisfaction, returning-viewer, and continuation signals. A channel-learning
workflow may then propose hypotheses, but observations remain provider evidence and humans approve
editorial changes.

Monetization is constrained by the product's educational purpose. Episodes must add original
synthesis, application, narrative, and visual explanation; they must not become automated readings,
generic image slideshows, or interchangeable templates. Rights review remains a release gate.
Advertising, disclosed affiliate links, sponsorships, memberships, and paid learning products are
possible future revenue paths, but none may authorize unsupported claims or misleading packaging.

## Source-processing method

For a book, extraction follows its semantic hierarchy rather than fixed token windows:

1. record front matter, contents, chapters, notes, references, index, figures, and page ranges;
2. create unit records for meaningful sections;
3. capture each unit's function, claims, evidence, examples, terms, tensions, and exact locators;
4. synthesize units into chapters and chapters into the whole work;
5. check coverage so later chapters and qualifications are not silently lost;
6. derive an idea map, learning questions, transfer cases, and unresolved questions;
7. only then choose the episode's controlling question and narrative path.

An empirical paper, conceptual paper, case study, and reference work may require different unit
records. The shared invariant is provenance, not one universal summarisation template.

## Doodle-animation direction

The initial renderer should use a restrained 2D doodle grammar:

- recurring people, products, interfaces, agents, and system components;
- stable symbols for source, evidence, interpretation, limitation, and unknown;
- objects that transform as the argument develops;
- a limited palette and consistent line weight;
- motion synchronized to conceptual change;
- stillness when the viewer needs to integrate a dense relationship.

The system should not draw every spoken noun or use unrelated generated images as visual filler.

## Future integration

[Learning Foundry](https://github.com/DG-creative-lab/codex-hack-learning-foundry) already owns a
local-first source pipeline, provenance-preserving Living Theory, learning artifacts, and distinct
human and agent evidence. Visual Learning Studio may later consume an explicitly selected,
versioned theory projection. It must not read Learning Foundry's private ledger directly.

[Human Systems Platform](https://github.com/DG-creative-lab/human-systems-platform) keeps external
products independent until adapter-based vertical slices reveal stable contracts. Visual Learning
Studio should eventually export a curated public episode-evidence candidate. That candidate remains
evidence eligible for separate review; it is not publication approval or proof of human competence.

## Open-source boundary

The repository is MIT licensed. A public release may include:

- runtime contracts and workflow code;
- synthetic fixtures;
- public-safe source metadata and locators;
- original diagrams and assets whose rights are clear;
- bounded example outputs when publication is allowed.

It must exclude:

- copyrighted source PDFs or EPUBs;
- private Apple Books data;
- personal filesystem paths;
- unrestricted extracted source text;
- private learner responses and model context;
- credentials and platform tokens;
- generated media whose source or asset rights have not been reviewed.

## Deferred deliberately

- full PDF structure extraction and unit-record persistence;
- direct model-provider integration;
- the first source synthesis and verified claim ledger;
- text-to-speech provider selection;
- Remotion or another animation renderer;
- YouTube upload;
- YouTube Analytics ingestion and channel-learning recommendations;
- automated title or thumbnail experimentation;
- revenue-provider integrations;
- a mascot rig or Rive integration;
- Learning Foundry and Human Systems Platform adapters;
- cloud storage, accounts, and multi-user collaboration.

The next vertical slice is deliberately narrow: extract and map the complete structure of
_Emotional Design_, create source-located unit records, and prove full coverage before proposing the
episode narrative.
