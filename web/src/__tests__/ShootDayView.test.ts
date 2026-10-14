import { flushPromises, mount } from '@vue/test-utils'
import axe from 'axe-core'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '../router'
import ShootDayView from '../views/ShootDayView.vue'

const day = {
  id: '1', unit: 'Main Unit', locationName: 'Stage 7', callAt: '2026-11-02T07:00:00', wrapAt: '2026-11-02T19:00:00',
  notes: 'Ep 201 interiors', version: 0, production: { id: '1', title: 'Northern Lights' },
  assignments: [
    { id: '10', role: 'Director of Photography', crewMemberId: 'crew-001', crewMember: { id: 'crew-001', name: 'Maya Okafor', department: 'Camera', email: 'maya@example.com', pronouns: 'she/her' } },
    { id: '11', role: 'Gaffer', crewMemberId: 'crew-003', crewMember: { id: 'crew-003', name: 'Sam Whitfield', department: 'Grip & Electric', email: 'sam@example.com' } },
  ],
}

const conflict = {
  __typename: 'SchedulingConflict', crewMemberId: 'crew-004', message: 'conflict',
  conflicts: [{ type: 'DOUBLE_BOOKED', message: 'Already booked on Northern Lights (Second Unit)', shootDayId: '2',
    productionTitle: 'Northern Lights', unit: 'Second Unit', callAt: '2026-11-02T05:30:00', wrapAt: '2026-11-02T14:00:00' }],
}

/** Routes each GraphQL request to a canned response based on the operation text. */
function mockApi(overrides: Record<string, unknown> = {}) {
  const responses: [RegExp, unknown][] = [
    [/assignCrew/, { assignCrew: conflict }],
    [/rescheduleShootDay/, { __error: { message: 'Shoot day 1 was changed by someone else', extensions: { code: 'STALE_UPDATE' } } }],
    [/checkConflicts/, { checkConflicts: [] }],
    [/crew\(availableOn/, { crew: { total: 1, items: [{ id: 'crew-004', name: 'Lucia Ferreira', department: 'Camera', roles: ['Camera Operator'] }] } }],
    [/shootDay\(id/, { shootDay: day }],
    ...Object.entries(overrides).map(([k, v]) => [new RegExp(k), v] as [RegExp, unknown]),
  ]
  globalThis.fetch = vi.fn(async (_url, init) => {
    const { query } = JSON.parse(String((init as RequestInit).body))
    const match = [...responses].reverse().find(([rx]) => rx.test(query))
    const data = match?.[1] as Record<string, unknown> | undefined
    const body = data && '__error' in data ? { errors: [data.__error] } : { data }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
}

async function mountView() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const wrapper = mount(ShootDayView, { props: { id: '1' }, attachTo: document.body.appendChild(document.createElement('main')), global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  document.body.innerHTML = ''
  document.documentElement.lang = 'en'
  mockApi()
})

describe('ShootDayView', () => {
  it('renders crew grouped by department', async () => {
    const w = await mountView()
    expect(w.find('h1').text()).toContain('Northern Lights: Main Unit')
    const groups = w.findAll('th[scope="colgroup"]').map((th) => th.text())
    expect(groups).toEqual(['Camera', 'Grip & Electric'])
    expect(w.text()).toContain('7:00 AM – 7:00 PM')
  })

  it('shows scheduling conflicts returned by the API as an alert', async () => {
    const w = await mountView()
    await w.find('select').setValue('crew-004')
    await flushPromises()
    await w.find('form[aria-labelledby="assign-heading"]').trigger('submit')
    await flushPromises()
    const alert = w.find('[role="alert"]')
    expect(alert.text()).toContain('Double-booked')
    expect(alert.text()).toContain('Second Unit')
  })

  it('tells the user when their edit is stale instead of overwriting', async () => {
    const w = await mountView()
    await w.findAll('button').find((b) => b.text() === 'Reschedule')!.trigger('click')
    await w.find('form[aria-label="Reschedule shoot day"]').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Someone else changed this shoot day')
  })

  it('has no detectable accessibility violations', async () => {
    await mountView()
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
