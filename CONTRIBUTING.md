# Contributing

Contributions are welcome, especially fixes for ChatGPT DOM changes and browser compatibility issues.

## Before opening a pull request

1. Keep the userscript dependency-free.
2. Avoid generated/hash class names when a stable attribute or structural check is available.
3. Do not make reasoning detection depend on translated UI text.
4. Do not add tracking, analytics, external telemetry, or unnecessary userscript permissions.
5. Preserve existing user settings when changing configuration storage.
6. Increment `@version` only for a release-ready change.
7. Run:

```bash
node --check chatgpt-long-conversation-dom-optimizer.user.js
```

## Bug reports

Include:

- Browser and version
- Tampermonkey/userscript-manager version
- Userscript version
- ChatGPT interface language
- Reproduction steps
- Relevant DOM snippet when the issue is selector-related

Do not include private conversation content unless it is necessary and has been redacted.
