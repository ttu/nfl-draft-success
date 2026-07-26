# Self-hosted fonts

These are the same variable-font files Google Fonts served, downloaded and
committed so they load from our own origin. Loading them from
`fonts.googleapis.com` put a render-blocking stylesheet on the critical path and
a three-hop chain (document → googleapis CSS → gstatic woff2) in front of first
paint. Self-hosting removes both hops at identical byte cost.

The `@font-face` declarations and the `<link rel="preload">` hints live together
in `index.html`, both built from `%BASE_URL%`, so the two URLs stay identical
under any base and the preloaded response is reused instead of fetched twice.

| Family         | Files                              | Weights |
| -------------- | ---------------------------------- | ------- |
| Space Grotesk  | `space-grotesk-{latin,latin-ext}`  | 400–700 |
| Geist          | `geist-{latin,latin-ext}`          | 400–700 |
| JetBrains Mono | `jetbrains-mono-{latin,latin-ext}` | 400–700 |

Each family is a single variable file spanning 400–700, so one face covers every
weight in the design system. Only the `latin` subsets are preloaded; `latin-ext`
is declared with its own `unicode-range` and fetched on demand for the
occasional accented player name.

## Updating

Fetch the CSS with a modern browser User-Agent (Google serves `woff2` only to
browsers that advertise support) and download the `latin` and `latin-ext` URLs:

```
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400..700&family=Geist:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap"
```

If the `unicode-range` values change upstream, update the `@font-face` blocks in
`index.html` to match.

## License

All three families are licensed under the SIL Open Font License 1.1. See
[`OFL.txt`](./OFL.txt) for the full text and the copyright notices.
