/** Fictional demo crew. Ids line up with the scheduling-service seed migration. */
export const SEED_CREW = [
  { id: 'crew-001', name: 'Maya Okafor', department: 'Camera', roles: ['Director of Photography'], email: 'maya.okafor@example.com', pronouns: 'she/her', unavailable: [] },
  { id: 'crew-002', name: 'Dev Raman', department: 'Production', roles: ['1st Assistant Director'], email: 'dev.raman@example.com', unavailable: [] },
  { id: 'crew-003', name: 'Sam Whitfield', department: 'Grip & Electric', roles: ['Gaffer', 'Best Boy Electric'], email: 'sam.whitfield@example.com', pronouns: 'they/them', unavailable: [{ from: '2026-11-10', to: '2026-11-14', reason: 'Prior booking' }] },
  { id: 'crew-004', name: 'Lucia Ferreira', department: 'Camera', roles: ['Camera Operator', '1st AC'], email: 'lucia.ferreira@example.com', unavailable: [] },
  { id: 'crew-005', name: 'Kofi Mensah', department: 'Sound', roles: ['Sound Mixer'], email: 'kofi.mensah@example.com', unavailable: [] },
  { id: 'crew-006', name: 'Hana Sato', department: 'Art', roles: ['Production Designer'], email: 'hana.sato@example.com', unavailable: [{ from: '2026-11-02', to: '2026-11-03', reason: 'Personal' }] },
  { id: 'crew-007', name: 'Andre Lewis', department: 'Music', roles: ['Music Supervisor'], email: 'andre.lewis@example.com', unavailable: [] },
  { id: 'crew-008', name: 'Priya Nair', department: 'Hair & Makeup', roles: ['Key Makeup Artist'], email: 'priya.nair@example.com', unavailable: [] },
];

export async function seedIfEmpty(repo, log) {
  if ((await repo.count()) > 0) return;
  await repo.insertMany(SEED_CREW);
  log?.info({ count: SEED_CREW.length }, 'seeded demo crew');
}
