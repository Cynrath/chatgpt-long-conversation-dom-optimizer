# Changelog

All notable changes to this project are documented here.

## [0.5.0] - 2026-09-22

### Changed

- Replaced continuous/manual-click reasoning overrides with a simpler one-shot-per-block model.
- Each reasoning disclosure is marked as handled the first time it is recognized; later manual opens are left alone.
- Closed reasoning blocks are also marked as handled, preventing a later manual open from being immediately auto-collapsed.
- The explicit Optimize action now force-closes all currently open reasoning blocks, regardless of whether they were handled before.

### Added

- Added an always-visible **Optimize** shortcut in the panel header, immediately to the left of the expand/collapse button.

### Removed

- Removed the trusted-click race handling and manual/pending reasoning override system introduced in v0.4.x.

## [0.4.2] - 2026-09-22

### Fixed

- Fixed a race where the periodic auto-collapse check could run immediately after a manual click and close the reasoning block before the manual-open override was recorded.
- User-clicked reasoning blocks are now protected immediately during the ChatGPT disclosure state transition, then promoted to a persistent per-block session override after the DOM settles.

## [0.4.1] - 2026-09-22

### Changed

- Manual reasoning interaction now takes precedence over automatic collapsing.
- Opening a reasoning block manually creates a per-block override keyed by conversation, turn ID, and reasoning position.
- New reasoning blocks in the same or another conversation continue to auto-collapse independently.
- Manually closing an overridden reasoning block removes its override.
- Manual overrides use `sessionStorage`, so they persist while navigating in the same tab without accumulating permanently.

## [0.4.0] - 2026-09-22

### Added

- Language-independent automatic collapse for open reasoning/analysis blocks.
- Reasoning toggle in the floating control panel.
- Turkish panel localization with English fallback.
- Tampermonkey `@updateURL` and `@downloadURL` metadata.
- Public repository metadata, documentation, issue templates, and CI syntax validation.

### Changed

- Cleaned userscript source for public distribution.
- Kept the existing local configuration storage key to preserve prior settings.
- Periodic reasoning checks only scan recent turns after the initial full scan.

## [0.3.0] - 2026-09-22

### Added

- Initial automatic analysis-block collapsing prototype.

## [0.2.0] - 2026-09-22

### Added

- Long-conversation turn hiding/restoration.
- Optional native `content-visibility` optimization.
- Floating controls and persisted settings.
