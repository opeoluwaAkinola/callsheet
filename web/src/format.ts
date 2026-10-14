const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })

// Times are wall-clock local to the set, so they are treated as UTC to avoid browser-timezone shifts.
const asUtc = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : `${iso.slice(0, 19)}Z`)

export const formatDate = (iso: string) => dateFmt.format(asUtc(iso))
export const formatTime = (iso: string) => timeFmt.format(asUtc(iso))
export const formatRange = (callAt: string, wrapAt: string) => {
  const sameDay = callAt.slice(0, 10) === wrapAt.slice(0, 10)
  return `${formatTime(callAt)} – ${formatTime(wrapAt)}${sameDay ? '' : ' (+1)'}`
}
export const hours = (callAt: string, wrapAt: string) =>
  Math.round(((asUtc(wrapAt).getTime() - asUtc(callAt).getTime()) / 36e5) * 10) / 10

/** `datetime-local` inputs want YYYY-MM-DDTHH:mm. */
export const toInputValue = (iso: string) => iso.slice(0, 16)
export const fromInputValue = (v: string) => (v.length === 16 ? `${v}:00` : v)
