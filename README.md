# glob-trace

A small TypeScript library for matching file globs and, more importantly,
explaining *why* a path did or did not match a pattern.

`fnmatch`-style globs are everywhere (`.gitignore`, build tool includes,
lint configs) but every implementation is a little different, and when a
pattern silently fails to match a file the usual debugging step is to stare
at the string until something clicks. This library keeps the match logic
small and exposes an `explain` function that returns a structured reason
instead of just `true` / `false`.

No dependencies. Node's standard library (just `RegExp` and string methods)
is enough.

## Supported syntax

Per path segment (segments are split on `/`):

- `*` — any run of characters, not crossing a `/`
- `?` — exactly one character, not `/`
- `[abc]` — a character class; `[!abc]` or `[^abc]` negates it
- `\x` — escapes `x` so it is treated literally

Between segments, a lone `**` matches zero or more whole segments,
including none, so `a/**/b` matches `a/b` as well as `a/x/y/b`.

Across the whole pattern:

- `{a,b}` — brace expansion; matches if any alternative matches. Groups
  nest and alternatives may contain `/`, so `a/{b,c/d}` matches `a/b` and
  `a/c/d`.

Extglob patterns are not supported.

## Usage

```ts
import { matchGlob, explainGlob, format } from 'glob-trace'

matchGlob('src/**/*.test.ts', 'src/lib/format.test.ts') // true
matchGlob('src/**/*.test.ts', 'src/lib/format.ts')      // false
matchGlob('*.{ts,tsx}', 'index.tsx')                    // true
```

When a match fails and it is not obvious why, use `explainGlob`:

```ts
const result = explainGlob('src/*.ts', 'src/lib/index.ts')

console.log(format(result, 'human'))
// NO MATCH  pattern="src/*.ts" path="src/lib/index.ts"
//   pattern has 2 segment(s) but path has 3

console.log(format(result, 'json'))
// {
//   "pattern": "src/*.ts",
//   "path": "src/lib/index.ts",
//   "matched": false,
//   "regexSource": "^src/[^/]*\\.ts$",
//   "detail": "pattern has 2 segment(s) but path has 3"
// }
```

The `human` mode is meant for a terminal; the `json` mode is meant for a
caller that wants to consume the result programmatically, for example a
CLI built on top of this library that offers its own `--json` flag.

## Why segment-by-segment reasons stop at `**` and `{a,b}`

A pattern like `a/**/b` can absorb a different number of path segments
depending on what is around it, so there is no single "segment 3" to point
at when it fails to match. A pattern with brace expansion has a similar
problem: `{a,b/c}/d` compiles to more than one candidate pattern, and a
failed match doesn't say which candidate came closest. For patterns
containing `**` or `{...}`, `explainGlob` falls back to reporting the
compiled regex source instead of a segment index — still useful for
debugging, just less precise.

## Status

Early skeleton. The matcher and explainer cover the syntax listed above;
see the roadmap in commit history for what is planned next.

## License

MIT, see [LICENSE](LICENSE).
