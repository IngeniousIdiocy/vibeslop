# Phase 7 – Utilities & Games

## Objectives
- Implement Calculator, Minesweeper, Command Prompt, and system utilities (Run, Find, Shut Down, Close Program).
- Ensure utilities integrate with shell shortcuts, Start menu, and VFS where applicable.

## Deliverables
1. Calculator app with standard mode, memory keys, keyboard bindings, error handling for divide by zero, display overflow management.
2. Minesweeper app with beginner/intermediate/expert/custom board, timer, mine counter, high-score tracking within session, first-click safety.
3. Command Prompt with DOS-like command set (dir, cd, type, copy, del, md, rd, rename, start, edit, help, echo, rem, goto, labels, pause) and batch execution.
4. Run dialog launching apps by ID/path/URL; Find dialog reusing Explorer search; Shut Down workflow with confirmation; Close Program list enabling end task.

## Engineering Tasks
- Build calculator logic engine with decimal precision and memory state; integrate with UI toolkit buttons.
- Implement Minesweeper board generation, cell state machine, recursion for zero reveals, timer control via kernel events.
- Implement command parser and executor; integrate with VFS for file operations and with process service for launching apps.
- Provide scriptable interface for tests to seed Minesweeper boards and pre-populate command history.
- Implement Run/Find/Shut Down/Close Program windows with proper menu commands and keyboard support.

## Testing
- **Unit**: Calculator operations, command parser grammar, batch script execution, Minesweeper board validator.
- **Integration**: Playwright scenario solving Minesweeper (using deterministic seed), executing command sequences (create file, edit via Notepad), launching apps via Run, terminating an app via Close Program.
- **Visual**: Snapshots for Calculator, Minesweeper (various states), Command Prompt, Close Program dialog.
- **Accessibility**: Keyboard navigation for Calculator buttons, screen reader labels for Minesweeper grid.

## Manual QA Checklist
- Calculator memory keys (MC/MR/MS/M+/M-) behave correctly; keyboard entry matches UI input.
- Minesweeper high scores update and display, smiley face state transitions correct.
- Command Prompt supports piping limited built-ins (e.g., `type file.txt | more` stub) and handles invalid commands gracefully.
- Run dialog autocompletes file paths where possible; Find dialog surfaces search results with correct double-click behavior.
- Shut Down displays options (Shut down, Restart, Stand by stub), triggers boot splash on restart; Close Program End Task works.

## Dependencies
- Phases 1–6 complete.

## Exit Criteria
- Automated suites passing.
- Manual QA logged.
- Feature parity matrix updated for utilities and games.
