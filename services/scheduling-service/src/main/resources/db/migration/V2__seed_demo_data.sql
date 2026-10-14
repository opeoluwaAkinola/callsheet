-- Demo data so the app is useful the moment `docker compose up` finishes.
-- Crew member ids match the seed data in crew-service.
INSERT INTO production (title, start_date, end_date) VALUES
    ('Northern Lights (Season 2)', DATE '2026-11-02', DATE '2026-12-18'),
    ('Studio Sessions: Live', DATE '2026-11-03', DATE '2026-11-07');

INSERT INTO shoot_day (production_id, unit, location_name, call_at, wrap_at, notes) VALUES
    (1, 'Main Unit',   'Stage 7, Culver City',      TIMESTAMP '2026-11-02 07:00:00', TIMESTAMP '2026-11-02 19:00:00', 'Ep 201 interiors'),
    (1, 'Second Unit', 'Griffith Park, Fern Dell',  TIMESTAMP '2026-11-02 05:30:00', TIMESTAMP '2026-11-02 14:00:00', 'Dawn exteriors'),
    (1, 'Main Unit',   'Stage 7, Culver City',      TIMESTAMP '2026-11-03 07:00:00', TIMESTAMP '2026-11-03 19:00:00', 'Ep 201 interiors cont.'),
    (2, 'Main Unit',   'Studio B, Hollywood',       TIMESTAMP '2026-11-03 12:00:00', TIMESTAMP '2026-11-03 23:00:00', 'Live session taping');

INSERT INTO assignment (shoot_day_id, crew_member_id, role) VALUES
    (1, 'crew-001', 'Director of Photography'),
    (1, 'crew-002', '1st Assistant Director'),
    (1, 'crew-003', 'Gaffer'),
    (2, 'crew-004', 'Camera Operator'),
    (3, 'crew-001', 'Director of Photography'),
    (4, 'crew-005', 'Sound Mixer');
