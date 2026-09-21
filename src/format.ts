import type { GlobExplanation } from './explain.js'

export type OutputMode = 'human' | 'json'

export function formatHuman(explanation: GlobExplanation): string {
  const status = explanation.matched ? 'MATCH' : 'NO MATCH'
  return `${status}  pattern="${explanation.pattern}" path="${explanation.path}"\n  ${explanation.detail}`
}

export function formatJson(explanation: GlobExplanation): string {
  return JSON.stringify(explanation, null, 2)
}

// Single entry point for callers that let a user pick the mode, e.g. a
// --json flag in a tool built on top of this library.
export function format(explanation: GlobExplanation, mode: OutputMode): string {
  return mode === 'json' ? formatJson(explanation) : formatHuman(explanation)
}
