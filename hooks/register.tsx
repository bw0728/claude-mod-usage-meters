import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])
const contextPercent = atom({ plugin: 'usage-bars', key: 'contextPercent' } as const, null as number | null)

const WIDTH = 20
const LABEL_WIDTH = 8
const ROWS = [
  { kind: 'five_hour', label: '5-hour' },
  { kind: 'seven_day', label: 'Weekly' },
]
// Toast once per window as usage crosses each level.
const ALERT_LEVELS = [90, 75]

// Zones: green to 50%, yellow to 75%, orange to 85%, red above.
function zoneColor(pct: number): string {
  if (pct < 50) return 'green'
  if (pct < 75) return 'yellow'
  if (pct < 85) return '#ff9900'
  return 'red'
}

function timeLeft(resetsAt: string | undefined): string {
  if (!resetsAt) return ''
  const mins = Math.max(0, Math.round((Date.parse(resetsAt) - Date.now()) / 60000))
  if (mins >= 1440) return `resets in ${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`
  if (mins >= 60) return `resets in ${Math.floor(mins / 60)}h ${mins % 60}m`
  return `resets in ${mins}m`
}

function levelFor(pct: number): number {
  for (const level of ALERT_LEVELS) {
    if (pct >= level) return level
  }
  return 0
}

// Highest level already announced per window. Module-level, so a reload re-seeds
// it from session.start instead of toasting for a level already passed.
const alerted: Record<string, number> = {}

// Returns toast texts for windows that crossed a new level; a lower level than
// before means the window reset, so the memory just follows it down.
function newAlerts(all: Limit[]): string[] {
  const texts: string[] = []
  for (const row of ROWS) {
    const lim = all.find(l => l.kind === row.kind)
    if (!lim) continue
    const level = levelFor(lim.percentUsed)
    if (level > (alerted[row.kind] || 0)) {
      texts.push(`${row.label} usage at ${lim.percentUsed.toFixed(1)}% (${timeLeft(lim.resetsAt)})`)
    }
    alerted[row.kind] = level
  }
  return texts
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()
    for (const lim of usage.rateLimits) {
      alerted[lim.kind] = levelFor(lim.percentUsed)
    }
    await update($, limits, () => usage.rateLimits)
    await update($, contextPercent, () => usage.context.percent ?? null)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits)
      for (const text of newAlerts(e.rateLimits)) {
        $.ui.toast(text)
      }
    }
    if (e.changed.includes('context')) {
      await update($, contextPercent, () => e.context.percent ?? null)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const all = await read($, limits)
    const ctx = await read($, contextPercent)
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    function bar(key: string, label: string, value: number, note: string) {
      const pct = Math.min(100, Math.max(0, value))
      const filled = Math.round((pct / 100) * WIDTH)
      return (
        <Box key={key}>
          <Text dimColor>{label.padEnd(LABEL_WIDTH)}</Text>
          <Text color={zoneColor(pct)}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(WIDTH - filled)}</Text>
          <Text> {pct.toFixed(1).padStart(5)}% </Text>
          <Text dimColor>{note}</Text>
        </Box>
      )
    }

    const lines = []
    for (const row of ROWS) {
      const lim = all.find(l => l.kind === row.kind)
      if (lim) lines.push(bar(row.kind, row.label, lim.percentUsed, timeLeft(lim.resetsAt)))
    }
    if (ctx !== null) {
      lines.push(bar('context', 'Context', ctx, 'this chat'))
    }
    if (lines.length === 0) return next(e)

    return <Box flexDirection="column">{lines}</Box>
  })
}
