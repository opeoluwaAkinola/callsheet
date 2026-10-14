import { describe, expect, it } from 'vitest'
import { formatRange, fromInputValue, hours, toInputValue } from '../format'

describe('format', () => {
  it('formats same-day and overnight ranges', () => {
    expect(formatRange('2026-11-02T07:00:00', '2026-11-02T19:00:00')).toBe('7:00 AM – 7:00 PM')
    expect(formatRange('2026-11-02T14:00:00', '2026-11-03T01:30:00')).toBe('2:00 PM – 1:30 AM (+1)')
  })

  it('computes shooting hours', () => {
    expect(hours('2026-11-02T07:00:00', '2026-11-02T19:30:00')).toBe(12.5)
  })

  it('round-trips datetime-local values', () => {
    expect(fromInputValue(toInputValue('2026-11-02T07:00:00'))).toBe('2026-11-02T07:00:00')
  })
})
