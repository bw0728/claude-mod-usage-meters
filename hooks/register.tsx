import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])

const WIDTH = 20
const ROWS = [
  { kind: 'five_hour', label: '5-hour' },
  { kind: 'seven_day', label: 'Weekly' },
]

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()
    await update($, limits, () => usage.rateLimits)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, limits, () => e.rateLimits)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const all = await read($, limits)
    if (e.props.hasSurvey || all.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const lines = []
    for (const row of ROWS) {
      const lim = all.find(l => l.kind === row.kind)
      if (!lim) continue
      const pct = Math.min(100, Math.max(0, lim.percentUsed))
      const filled = Math.round((pct / 100) * WIDTH)
      lines.push(
        <Box key={row.kind}>
          <Text dimColor>{row.label.padEnd(7)}</Text>
          <Text color={zoneColor(pct)}>{'█'.repeat(filled)}</Text>
          <Text dimColor>{'░'.repeat(WIDTH - filled)}</Text>
          <Text> {pct.toFixed(1).padStart(5)}%</Text>
          <Text dimColor>{timeLeft(lim.resetsAt)}</Text>
        </Box>,
      )
    }
    if (lines.length === 0) return next(e)

    return <Box flexDirection="column">{lines}</Box>
  })
}
