# ChatGPT Long Conversation DOM Optimizer

[![Version](https://img.shields.io/badge/version-0.4.2-blue.svg)](https://github.com/Cynrath/chatgpt-long-conversation-dom-optimizer/blob/main/CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/userscript-Tampermonkey-black.svg)](https://www.tampermonkey.net/)

A lightweight userscript that keeps very long ChatGPT conversations responsive without deleting conversation state from the page. It can hide older turn wrappers from layout/rendering, use native `content-visibility`, and automatically collapse open reasoning/analysis blocks.

[**Install / Update userscript**](https://raw.githubusercontent.com/Cynrath/chatgpt-long-conversation-dom-optimizer/main/chatgpt-long-conversation-dom-optimizer.user.js)

## Features

- Keeps only the most recent conversation turns visible while preserving the existing DOM.
- Restores older turns on demand.
- Uses `content-visibility: auto` for off-screen rendered turns.
- Automatically collapses new/open reasoning/analysis blocks.
- A reasoning block you open manually is exempt from auto-collapse while that tab session remains active; later reasoning blocks are still handled independently.
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

If you already installed the script manually, installing the repository version with the same userscript identity should update/replace that installation instead of requiring a second copy. Check Tampermonkey afterward and keep only one enabled copy.

## Default settings

| Setting | Default | Purpose |
| --- | ---: | --- |
| Keep recent turns | `40` | Number of newest turn wrappers kept visible after optimization |
| Reveal step | `20` | Number of older turns restored per click |
| Auto threshold | `80` | Automatic turn optimization starts at this conversation size |
| Automatic | On | Automatically applies long-conversation optimization |
| CV | On | Enables native `content-visibility` optimization |
| Reasoning | On | Automatically collapses new reasoning/analysis blocks while respecting manual per-block opens |

Settings are stored locally in the browser using `localStorage`.

## How reasoning collapse works

The script intentionally avoids matching translated text. It identifies the open reasoning disclosure from its DOM structure and open-state content container, while excluding tool-message containers.

Manual interaction takes precedence over automation. As soon as you click a reasoning disclosure, that specific block is temporarily protected from the auto-collapse loop while ChatGPT applies the UI state change. Once the DOM settles, an override is stored for that conversation turn and reasoning position if the block is open. That block stays open, while reasoning blocks in later turns continue to auto-collapse normally. Closing the same block manually removes its override.

These overrides are stored in `sessionStorage`, so they survive navigation between chats in the same tab but are not kept indefinitely across browser sessions.

This makes the feature usable across ChatGPT interface languages without maintaining a list of translated labels.

The detection is intentionally conservative: if ChatGPT changes the relevant DOM structure, it should stop matching rather than click unrelated controls.

## Console API

The script exposes a small API for debugging and manual control:

```js
ChatGPTDOMOptimizer.stats();
ChatGPTDOMOptimizer.optimize();
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

If something stops working, open a [bug report](https://github.com/Cynrath/chatgpt-long-conversation-dom-optimizer/issues/new/choose) and include the browser, userscript-manager version, script version, and the affected ChatGPT UI behavior.

## Development

The repository includes a GitHub Actions syntax check for the userscript. For a local syntax check:

```bash
node --check chatgpt-long-conversation-dom-optimizer.user.js
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting changes.

## License

MIT © 2026 [Cynrath](https://github.com/Cynrath)
