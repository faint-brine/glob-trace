// Glob compilation and matching.
//
// Supported syntax, one path segment at a time (segments are split on '/'):
//   *        any run of characters, not crossing a '/'
//   ?        exactly one character, not '/'
//   [abc]    a character class; [!abc] or [^abc] negates it
//   \x       escapes x so it is treated literally
// Between segments, a lone "**" matches zero or more whole segments,
// including none, so "a/**/b" matches "a/b" as well as "a/x/y/b".
//
// Brace expansion ({a,b}) and extglob patterns are not supported yet.

export interface CompiledGlob {
  readonly source: string
  readonly regex: RegExp
}

const REGEX_SPECIAL = /[.+^${}()|\\]/g

function escapeLiteral(char: string): string {
  return char.replace(REGEX_SPECIAL, '\\$&')
}

// Turns a single path segment (no '/') into a regex source fragment.
// Exported so explainGlob can re-check one segment at a time.
export function compileSegment(segment: string): string {
  let out = ''
  let i = 0
  while (i < segment.length) {
    const ch = segment[i]
    if (ch === '*') {
      out += '[^/]*'
      i += 1
    } else if (ch === '?') {
      out += '[^/]'
      i += 1
    } else if (ch === '[') {
      const close = segment.indexOf(']', i + 1)
      if (close === -1) {
        // no closing bracket: treat '[' as a literal
        out += '\\['
        i += 1
        continue
      }
      let body = segment.slice(i + 1, close)
      if (body.startsWith('!') || body.startsWith('^')) {
        body = '^' + body.slice(1)
      }
      out += '[' + body + ']'
      i = close + 1
    } else if (ch === '\\' && i + 1 < segment.length) {
      out += escapeLiteral(segment[i + 1] as string)
      i += 2
    } else {
      out += escapeLiteral(ch as string)
      i += 1
    }
  }
  return out
}

export function compileGlob(pattern: string): CompiledGlob {
  const rawSegments = pattern.split('/')
  const pieces = rawSegments.map((raw) => (raw === '**' ? 'GLOBSTAR' : compileSegment(raw)))

  let source = ''
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i] as string
    const isFirst = i === 0
    const isLast = i === pieces.length - 1
    if (piece === 'GLOBSTAR') {
      if (isFirst && isLast) {
        source += '.*'
      } else if (isFirst) {
        source += '(?:.*/)?'
      } else if (isLast) {
        source += '(?:/.*)?'
      } else {
        source += '/(?:.*/)?'
      }
    } else {
      if (i > 0 && pieces[i - 1] !== 'GLOBSTAR') {
        source += '/'
      }
      source += piece
    }
  }

  const full = '^' + source + '$'
  return { source: full, regex: new RegExp(full) }
}

export function matchGlob(pattern: string, path: string): boolean {
  return compileGlob(pattern).regex.test(path)
}
