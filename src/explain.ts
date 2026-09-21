import { compileGlob, compileSegment } from './glob.js'

export interface GlobExplanation {
  readonly pattern: string
  readonly path: string
  readonly matched: boolean
  readonly regexSource: string
  readonly detail: string
}

// Matching itself is one regex test; the point of this function is to say
// *why* a pattern did not match, by walking segment by segment. That walk
// only gives a precise answer when the pattern has no "**", since a
// globstar can absorb a different number of segments depending on what is
// around it, so there is no single "segment i" to compare there.
export function explainGlob(pattern: string, path: string): GlobExplanation {
  const compiled = compileGlob(pattern)
  const matched = compiled.regex.test(path)

  if (matched) {
    return {
      pattern,
      path,
      matched: true,
      regexSource: compiled.source,
      detail: 'pattern matched the full path',
    }
  }

  if (pattern.includes('**')) {
    return {
      pattern,
      path,
      matched: false,
      regexSource: compiled.source,
      detail: 'pattern did not match; "**" makes a precise segment location unreliable, see regexSource',
    }
  }

  const patternSegments = pattern.split('/')
  const pathSegments = path.split('/')

  if (patternSegments.length !== pathSegments.length) {
    return {
      pattern,
      path,
      matched: false,
      regexSource: compiled.source,
      detail: `pattern has ${patternSegments.length} segment(s) but path has ${pathSegments.length}`,
    }
  }

  for (let i = 0; i < patternSegments.length; i++) {
    const segmentSource = '^' + compileSegment(patternSegments[i] as string) + '$'
    const segmentRegex = new RegExp(segmentSource)
    if (!segmentRegex.test(pathSegments[i] as string)) {
      return {
        pattern,
        path,
        matched: false,
        regexSource: compiled.source,
        detail: `segment ${i + 1} ("${pathSegments[i]}") does not match pattern segment "${patternSegments[i]}"`,
      }
    }
  }

  return {
    pattern,
    path,
    matched: false,
    regexSource: compiled.source,
    detail: 'pattern did not match for an undetermined reason',
  }
}
