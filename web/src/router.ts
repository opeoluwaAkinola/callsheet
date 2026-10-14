import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
    { path: '/', name: 'productions', component: () => import('./views/ProductionsView.vue'), meta: { title: 'Productions' } },
    { path: '/productions/:id', name: 'production', component: () => import('./views/ProductionView.vue'), props: true, meta: { title: 'Production' } },
    { path: '/shoot-days/:id', name: 'shoot-day', component: () => import('./views/ShootDayView.vue'), props: true, meta: { title: 'Shoot day' } },
    { path: '/crew', name: 'crew', component: () => import('./views/CrewView.vue'), meta: { title: 'Crew' } },
    { path: '/crew/:id', name: 'crew-member', component: () => import('./views/CrewMemberView.vue'), props: true, meta: { title: 'Crew member' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('./views/NotFoundView.vue'), meta: { title: 'Not found' } },
]

export const router = createRouter({ history: createWebHistory(), routes })

// Screen readers don't announce SPA navigations, so update the title and move focus to the new page's heading.
router.afterEach((to) => {
  document.title = `${to.meta.title ?? 'CallSheet'} · CallSheet`
  requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus())
})
