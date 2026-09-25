// Glob compilation and matching.
//
// Supported syntax, one path segment at a time (segments are split on '/'):
//   *        any run of characters, not crossing a '/'
//   ?        exactly one character, not '/'
//   [abc]    a character class; [!abc] or [^abc] negates it
//   \x       escapes x so it is treated literally
// Between segments, a lone "**" matches zero or more whole segments,
// including none, so "a/**/b" matches "a/b" as well as "a/x/y/b".
// {a,b} expands to alternatives before the rest of the pattern is compiled,
// so "a/{b,c}/d" matches "a/b/d" and "a/c/d". Braces nest and alternatives
// may contain "/", so "{a,b/c}/d" matches "a/d" and "b/c/d".
//
// Extglob patterns are not supported.

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

// Turns one brace-free pattern into a regex source fragment (no anchors).
// Exported so explainGlob can compile a single expansion the same way
// compileGlob does.
export function compilePatternBody(pattern: string): string {
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
  return source
}

// Finds the '}' that closes the '{' at openIndex, accounting for nested
// braces and backslash escapes. Returns -1 if there is no matching close.
function findMatchingBrace(pattern: string, openIndex: number): number {
  let depth = 0
  for (let i = openIndex; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === '{') {
      depth += 1
    } else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

// Splits on top-level commas only, ignoring commas nested inside braces and
// commas escaped with a backslash.
function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] as string
    if (ch === '\\' && i + 1 < body.length) {
      current += ch + body[i + 1]
      i += 1
      continue
    }
    if (ch === '{') depth += 1
    if (ch === '}') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}

// Expands {a,b} groups into every literal alternative they describe.
// Groups nest and alternatives may contain further groups or "/". A group
// with no top-level comma is not an alternation (matches shell behavior)
// and is kept as literal "{...}" text, though its contents are still
// scanned for nested groups.
export function expandBraces(pattern: string): string[] {
  let openIndex = -1
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]
    if (ch === '\\') {
      i += 1
      continue
    }
    if (ch === '{') {
      openIndex = i
      break
    }
  }
  if (openIndex === -1) return [pattern]

  const closeIndex = findMatchingBrace(pattern, openIndex)
  if (closeIndex === -1) return [pattern]

  const prefix = pattern.slice(0, openIndex)
  const body = pattern.slice(openIndex + 1, closeIndex)
  const suffix = pattern.slice(closeIndex + 1)
  const suffixExpansions = expandBraces(suffix)

  const alternatives = splitTopLevelCommas(body)
  if (alternatives.length < 2) {
    const bodyExpansions = expandBraces(body)
    const results: string[] = []
    for (const b of bodyExpansions) {
      for (const suf of suffixExpansions) {
        results.push(prefix + '{' + b + '}' + suf)
      }
    }
    return results
  }

  const results: string[] = []
  for (const alt of alternatives) {
    for (const altExpansion of expandBraces(alt)) {
      for (const suf of suffixExpansions) {
        results.push(prefix + altExpansion + suf)
      }
    }
  }
  return results
}

export function compileGlob(pattern: string): CompiledGlob {
  const expansions = expandBraces(pattern)
  const bodies = expansions.map(compilePatternBody)
  const source = bodies.length === 1 ? (bodies[0] as string) : '(?:' + bodies.join('|') + ')'

  const full = '^' + source + '$'
  return { source: full, regex: new RegExp(full) }
}

export function matchGlob(pattern: string, path: string): boolean {
  return compileGlob(pattern).regex.test(path)
}
