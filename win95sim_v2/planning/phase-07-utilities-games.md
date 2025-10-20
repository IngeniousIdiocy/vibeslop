# Phase 7 – Utilities & Games (Parallel App Pods)

**Status:** 🚧 Planned. Calculator, Minesweeper, Command Prompt, and shell utilities each live in isolated folders under `src/apps/utilities/` with shared infrastructure provided by `src/services/games/` and `src/services/cli/`. Each mini-app is assigned to a dedicated team so Phase 7 work can progress concurrently without stepping on other features.

## Objectives
- Implement Calculator, Minesweeper, Command Prompt, and system utilities (Run, Find, Shut Down, Close Program) as separate packages using shared tooling.
- Ensure utilities integrate with shell shortcuts, Start menu, and VFS via declarative manifests and service events instead of direct file edits.
- Provide frameworks for future games/utilities to plug into Start menu categories without modifying existing code.

## Deliverables
1. Calculator app with standard mode, memory keys, keyboard bindings, error handling for divide by zero, display overflow management located in `src/apps/utilities/calculator/`.
2. Minesweeper app with beginner/intermediate/expert/custom board, timer, mine counter, high-score tracking within session, first-click safety under `src/apps/games/minesweeper/`.
3. Command Prompt with DOS-like command set (dir, cd, type, copy, del, md, rd, rename, start, edit, help, echo, rem, goto, labels, pause) and batch execution under `src/apps/utilities/command-prompt/` plus shared CLI runtime `src/services/cli/`.
4. Run dialog launching apps by ID/path/URL; Find dialog reusing Explorer search; Shut Down workflow with confirmation; Close Program list enabling end task built as shell plugins under `src/apps/shell/utilities/`.
5. Shared scoreboard service `src/services/high-scores/` for Minesweeper and future games.
6. Documentation `docs/utilities-extension-guide.md` describing how to register new utilities without editing existing ones.

## Concurrency & Integration Boundaries
- Provide scaffolding CLI `scripts/create-utility.js` generating new app folders with tests and manifests to prevent merge conflicts.
- Publish TypeScript interfaces for CLI commands and game engines so teams can extend behaviour safely.
- Set up feature flags per utility enabling partial merges while features bake in hidden mode.
- Maintain `apps.json` manifest listing utilities consumed by Start menu; updates are append-only to avoid conflicts.

## Engineering Tasks
- Build calculator logic engine with decimal precision and memory state; integrate with UI toolkit buttons using component composition.
- Implement Minesweeper board generation, cell state machine, recursion for zero reveals, timer control via kernel events, and high-score persistence.
- Implement command parser and executor; integrate with VFS for file operations and with process service for launching apps using dependency injection for commands.
- Provide scriptable interface for tests to seed Minesweeper boards and pre-populate command history using fixtures in `tests/apps/games/`.
- Implement Run/Find/Shut Down/Close Program windows with proper menu commands and keyboard support registered through shell plugin API.

## Testing
- **Unit**: Calculator operations, command parser grammar, batch script execution, Minesweeper board validator executed via Jest per app folder.
- **Integration**: Playwright scenario solving Minesweeper (using deterministic seed), executing command sequences (create file, edit via Notepad), launching apps via Run, terminating an app via Close Program.
- **Visual**: Snapshots for Calculator, Minesweeper (various states), Command Prompt, Close Program dialog using Storybook.
- **Accessibility**: Keyboard navigation for Calculator buttons, screen reader labels for Minesweeper grid, CLI contrast compliance.

## Manual QA Checklist
- Calculator memory keys (MC/MR/MS/M+/M-) behave correctly; keyboard entry matches UI input.
- Minesweeper high scores update and display, smiley face state transitions correct.
- Command Prompt supports piping limited built-ins (e.g., `type file.txt | more` stub) and handles invalid commands gracefully.
- Run dialog autocompletes file paths where possible; Find dialog surfaces search results with correct double-click behaviour.
- Shut Down displays options (Shut down, Restart, Stand by stub), triggers boot splash on restart; Close Program End Task works.
- Confirm each utility/game remains within its folder aside from shared service updates.

## Dependencies
- Phases 1–6 complete with stable shell/dialog services; utilities consume but do not modify them.

## Exit Criteria
- Automated suites passing (unit, integration, visual, accessibility).
- Manual QA logged.
- Feature parity matrix updated for utilities and games and manifests merged without conflicts.
- Dependency lint ensures utilities import only approved services.
