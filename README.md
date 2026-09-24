# ChatGPT Long Conversation DOM Optimizer

[![Version](https://img.shields.io/badge/version-0.7.0-blue.svg)](https://github.com/Cynrath/chatgpt-long-conversation-dom-optimizer/blob/main/CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/userscript-Tampermonkey-black.svg)](https://www.tampermonkey.net/)

A lightweight userscript for long ChatGPT conversations. On the current ChatGPT interface it cooperates with ChatGPT's native turn virtualization and focuses on safe reasoning/analysis cleanup; on the legacy interface it can still hide older turn wrappers and use `content-visibility`.

[**Install / Update userscript**](https://raw.githubusercontent.com/Cynrath/chatgpt-long-conversation-dom-optimizer/main/chatgpt-long-conversation-dom-optimizer.user.js)

## Features

- Detects the current ChatGPT native virtualization contract (`data-thread-find-target="conversation"` + `data-turn-key`) and does not fight ChatGPT's own virtualized turn window.
- Keeps legacy turn hiding/restoration and `content-visibility` as a compatibility fallback for the previous conversation DOM.
- Automatically normalizes each reasoning/analysis block only once. If a block is open the first time the script sees it, it is collapsed; if it is already closed, it is simply marked as handled.
- After a reasoning block has been handled once, opening it manually does not trigger another automatic close. Later reasoning blocks are handled independently.
- The panel header includes an always-visible **Optimize** shortcut. Manual Optimize performs a one-shot force cleanup: it optimizes the DOM and closes every reasoning block that is currently open, even if that block was already handled.
- Shows a compact 2.6-second feedback toast after Optimize, DOM-only optimization, reasoning-history reset, or a DOM safety event.
- Includes a **DOM only** action for optimizing old conversation turns without touching reasoning blocks.
- Shows hidden-turn, handled-reasoning, and currently-open-reasoning counts in the panel.
- Includes a **Reset reasoning history** action for clearing the current tab session's handled keys.
- Supports **Alt+Shift+O** as an optional full-Optimize keyboard shortcut.
- Avoids automatic reasoning collapse while ChatGPT is actively streaming a response, including the current `role="status"[aria-busy="true"]` marker.
- Runs a conservative DOM self-check and pauses destructive automation if the expected conversation-root structure changes.
- Reasoning detection does **not** depend on labels such as `Analiz edildi`, `Reasoned`, or another UI language.
- Avoids watching streamed token changes with a heavy subtree observer.
- Preserves scroll position when old turns are hidden or restored.
- Includes a small floating control panel.
- Turkish UI when ChatGPT/browser language is Turkish; English UI otherwise.
- Supports Tampermonkey update checks through `@updateURL` and `@downloadURL`.
- No external requests, analytics, tracking, or additional userscript permissions.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or a compatible userscript manager.
2. Open the [userscript installation link](https://raw.githubusercontent.com/Cynrath/chatgpt-long-conversation-dom-optimizer/main/chatgpt-long-conversation-dom-optimizer.user.js).
3. Confirm **Install** in Tampermonkey.
4. Open or refresh `https://chatgpt.com/`.

If you installed an older manual copy that used a different `@namespace`, Tampermonkey may treat it as a separate userscript. After installing the repository version, check Tampermonkey and keep only one enabled copy.

## Default settings

| Setting | Default | Purpose |
| --- | ---: | --- |
| Keep recent turns | `40` | Number of newest turn wrappers kept visible after optimization |
| Reveal step | `20` | Number of older turns restored per click |
| Auto threshold | `80` | Automatic turn optimization starts at this conversation size |
| Automatic | On | Automatically applies long-conversation optimization |
| CV | On | Enables native `content-visibility` optimization |
| Reasoning | On | Processes each reasoning/analysis block once, then leaves later manual opens alone |
| Shortcut | On | Enables `Alt+Shift+O` for full Optimize |

Settings are stored locally in the browser using `localStorage`. Per-reasoning handled keys use `sessionStorage`. Obsolete v0.4.x manual-reasoning session keys are removed automatically.

## How reasoning collapse works

Automatic reasoning cleanup is **one-shot per block**, not a permanent enforcement loop.

Each reasoning disclosure gets a stable session key derived from the current conversation path, turn ID, and disclosure position. The first time the script recognizes that block:

- if it is open, the script collapses it once and marks it as handled;
- if it is already closed, the script only marks it as handled.

After that, automatic checks skip the block. This means you can open an older reasoning section to read it and the periodic optimizer will not close it again. A reasoning block that appears in a later turn has a different key and gets its own one-time automatic cleanup.

Handled keys are stored in `sessionStorage`, so navigation between chats in the same tab is remembered without creating permanent browser storage.

The **Optimize** button is intentionally different: it is an explicit one-shot override. Pressing it closes all reasoning blocks that are currently open, including blocks you previously reopened manually, and also runs the normal DOM optimization. After that click, normal one-shot behavior resumes.

Automatic reasoning collapse is skipped while ChatGPT exposes a streaming-state marker. The handled key is not recorded during that skip, so the block remains eligible for its normal one-shot cleanup after streaming finishes.

The **DOM only** action applies the long-conversation DOM optimization without closing reasoning blocks. The header Optimize shortcut and `Alt+Shift+O` continue to perform the full force cleanup.

The panel displays current hidden-turn, handled-reasoning, and open-reasoning counts. Optimize and related manual actions show a short feedback message for about 2.6 seconds.

Reasoning detection does not match translated labels such as `Analiz edildi` or `Reasoned`. On the current UI it uses the structural disclosure contract `button[aria-expanded][aria-labelledby]` inside a `data-turn-key` turn; the legacy detector remains as a fallback. If ChatGPT changes the relevant DOM structure, the detector is designed to fail closed instead of clicking unrelated controls.

## Console API

The script exposes a small API for debugging and manual control:

```js
ChatGPTDOMOptimizer.stats();
ChatGPTDOMOptimizer.optimize(); // force DOM optimization + close all currently open reasoning blocks
ChatGPTDOMOptimizer.optimizeDom(); // DOM only; leave reasoning blocks unchanged
ChatGPTDOMOptimizer.resetReasoning();
ChatGPTDOMOptimizer.selfCheck();
ChatGPTDOMOptimizer.revealOlder();
ChatGPTDOMOptimizer.collapseAnalyses();
ChatGPTDOMOptimizer.restore();
ChatGPTDOMOptimizer.pause();
ChatGPTDOMOptimizer.resume();
ChatGPTDOMOptimizer.config();
ChatGPTDOMOptimizer.destroy();
```

## Automatic updates

The userscript points Tampermonkey to the raw file in this repository:

```text
https://raw.githubusercontent.com/Cynrath/chatgpt-long-conversation-dom-optimizer/main/chatgpt-long-conversation-dom-optimizer.user.js
```

Each published update must increment the userscript `@version` value. Tampermonkey can then detect the newer version according to the user's update settings.

## Supported sites

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`

## Compatibility

ChatGPT is a frequently changing web application. This userscript deliberately relies on a small set of DOM attributes and structural checks instead of generated/hash class names where practical, but future ChatGPT UI changes can still require selector updates.

The runtime self-check verifies either the current native-virtualized conversation contract or the legacy conversation root before destructive operations. In native mode, legacy DOM hiding controls are disabled because ChatGPT already manages rendered turns. After repeated structural mismatches, the optimizer enters a runtime safety pause instead of continuing to click or alter DOM elements.

If something stops working, open a [bug report](https://github.com/Cynrath/chatgpt-long-conversation-dom-optimizer/issues/new/choose) and include the browser, userscript-manager version, script version, and the affected ChatGPT UI behavior.

## Development

The repository includes a GitHub Actions syntax check for the userscript. For a local syntax check:

```bash
node --check chatgpt-long-conversation-dom-optimizer.user.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## License

MIT © 2026 [Cynrath](https://github.com/Cynrath)
