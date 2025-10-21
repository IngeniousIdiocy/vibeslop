# Shell Command Reference

Phase 03 introduces a small set of shell command identifiers that are consumed by the desktop, taskbar, and Start menu. These IDs are stable contracts for downstream phases and external plugins.

| Command ID | Description |
| --- | --- |
| `shell:start:internet-explorer` | Launch the Internet Explorer (Navigator) app. |
| `shell:start:notepad` | Launch the Notepad application. |
| `shell:start:paint` | Launch the Paint application. |
| `shell:start:minesweeper` | Launch the Minesweeper game. |
| `shell:start:explorer` | Launch the Windows Explorer file browser. |
| `shell:start:control-panel` | Open the Control Panel surface. |
| `shell:start:taskbar-settings` | Open the Taskbar & Start Menu settings panel. |
| `shell:start:find-files` | Trigger the Find Files dialog. |
| `shell:start:help` | Open the Windows Help viewer. |
| `shell:start:run` | Focus the Run command dialog. |
| `shell:start:shutdown` | Begin the system shutdown workflow. |

Context menu commands use the shared menu registry exported from `src/ui/menus/`. Command identifiers should be prefixed with the owning feature (for example `desktop:refresh`) to avoid collisions. Future phases extending the shell should update this document when new commands are introduced.
