import { expect, test } from 'claude-code/testing'

const WINDOW = { window: 200000 }

function limits(five: number, week: number) {
  return [
    { kind: 'five_hour', percentUsed: five, resetsAt: '2030-01-01T00:00:00Z' },
    { kind: 'seven_day', percentUsed: week, resetsAt: '2030-01-01T00:00:00Z' },
  ]
}

test('toasts once per level, and again after the window resets', async ($, on) => {
  const toasts: string[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: WINDOW, rateLimits: [] } }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const measure = (five: number, week: number) =>
    $.session.measure({ context: WINDOW, rateLimits: limits(five, week), changed: ['rateLimits'] })

  await measure(10, 10)
  expect(toasts).toHaveLength(0)

  await measure(76, 10)
  expect(toasts).toHaveLength(1)
  expect(toasts[0]).toMatch(/5-hour usage at 76.0%/)

  await measure(80, 10)
  expect(toasts).toHaveLength(1)

  await measure(91, 10)
  expect(toasts).toHaveLength(2)

  await measure(5, 10)
  await measure(77, 10)
  expect(toasts).toHaveLength(3)
})

test('the band shows both limits and the context bar', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: WINDOW, rateLimits: [] } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.measure({
    context: { ...WINDOW, percent: 42 },
    rateLimits: limits(3.4, 60),
    changed: ['rateLimits', 'context'],
  })

  const ui = await $.ui.mount({
    plugin: 'usage-bars',
    component: 'AbovePrompt',
    surface: 'terminal',
    props: { hasSurvey: false, isWorking: false },
  } as never)

  expect(await ui.find({ type: 'Text', text: /3\.4%/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /60\.0%/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /42\.0%/ })).toBeTruthy()
  await ui.unmount()
})
