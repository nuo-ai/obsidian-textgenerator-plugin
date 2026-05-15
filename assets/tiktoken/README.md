# Tiktoken runtime assets

Copied from `@dqbd/tiktoken@1.0.22` for CDN delivery. The plugin downloads these on first token-count use and caches them in `.cache/tiktoken/` beside `main.js`.

**Do not edit manually.** To refresh after upgrading `@dqbd/tiktoken` in `package.json`:

```bash
pnpm run copy:tiktoken-assets
```

Raw URLs (GitHub CDN):

- `lite/tiktoken_bg.wasm`
- `encoders/cl100k_base.json`
- `encoders/r50k_base.json`
- `encoders/p50k_base.json`
