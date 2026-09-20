# ADR 0002: Separate truthful distribution planning from channel learning

## Status

Accepted for the first prototype.

## Context

An educational episode can be accurate and visually strong yet remain undiscoverable if its audience
promise, title, thumbnail, and opening are considered only after production. The project also aims
to become financially sustainable. This creates pressure to optimize platform metrics before the
channel has meaningful evidence and can encourage clickbait, repetitive automation, or generic
AI-produced videos.

## Decision

Distribution planning is part of the episode domain from the beginning. The episode project records:

- the intended viewer, their problem, the promised outcome, and the promise boundary;
- at least three title, thumbnail, and opening-hook candidates;
- the verified claims supporting each candidate;
- exactly one human-selected packaging candidate before script verification; and
- optional derivative plans whose source narrative beats and calls to action are explicit.

The selected title must match the exact release candidate approved for publication.

Platform analytics and revenue observations are deferred external boundaries. When implemented,
adapters will preserve provider, video identity, observation window, metric definition, and
freshness. A future channel-learning workflow may interpret those observations and propose an
experiment. It may not manufacture observations, silently rewrite published work, or treat one
metric as proof of audience value.

## Why

This makes discoverability a design input while preserving the source and audience promise as the
authority for what may be claimed. It prevents a high click-through rate or model-generated
confidence from laundering unsupported packaging into a release.

## Non-goals

- Predicting or reverse-engineering YouTube's recommendation algorithm.
- Automatically publishing or replacing titles and thumbnails.
- Building an analytics warehouse before the channel has enough episodes to learn from.
- Treating advertising revenue as the only measure of educational or business value.

## Initial acceptance criteria

- Packaging cannot become ready with fewer than three candidates.
- Exactly one candidate is selected.
- Every candidate cites claims registered in the episode.
- Release approval is blocked when the release title differs from the selected package.
- The first prototype remains runnable without YouTube credentials or analytics access.
