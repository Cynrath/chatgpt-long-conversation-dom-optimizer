# Changelog

All notable changes to this project are documented here.

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
