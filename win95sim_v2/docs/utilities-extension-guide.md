# Utilities & Games Extension Guide

Phase 07 introduces a manifest-driven workflow for adding desktop utilities and games
without editing shared shell code. Follow these steps when onboarding a new experience.

## 1. Generate a scaffold

Use the helper script to create a typed module stub, manifest, and Jest-style test harness:

```bash
node scripts/create-utility.js "My Utility"
```

This produces `src/apps/utilities/my-utility/` with an `index.ts` entry point and `manifest.json`
metadata, plus a matching test file under `tests/apps/utilities/`.

## 2. Register the app

Utilities and games are declared in `src/apps/apps.manifest.json`. The Start menu reads this file to
populate categories without requiring manual wiring. Manifest entries are append-only – add a new
record instead of editing an existing one to avoid merge conflicts between parallel teams.

Each record supports:

- `id`: unique identifier used by the process manager and launcher shortcuts.
- `title`: localized display name.
- `entry`: module specifier resolved via the module registry.
- `featureFlag`: optional flag checked by the shell before showing the shortcut.

## 3. Implement the module

Utilities should expose a `register()` function returning their manifest metadata. Modules may depend
on services from `@services/*` and shared UI components from `@ui/*`, but avoid reaching into other
apps to keep boundaries clean.

For games, reuse helpers from `@services/games` for deterministic RNG and `@services/highScores`
for session scoring. Minesweeper provides a reference implementation in
`src/apps/games/minesweeper/` showing how to compose these services through the
`createMinesweeperApp()` UI wrapper.

## 4. Testing expectations

- Add unit tests for new engines or service integrations beneath `tests/apps/`.
- Seed deterministic randomness via `createSeededRandom()` so suites do not flake.
- Use the high score service to simulate scoreboard updates where applicable.

Following this flow ensures new utilities can land without conflicting with concurrent phase work
or breaking the shell boot path.
