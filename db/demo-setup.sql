-- Team Timesheets (live from Jira). Safe to run more than once.
CREATE TABLE IF NOT EXISTS employees (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  emp_no      TEXT,
  email       TEXT,
  team        TEXT NOT NULL DEFAULT 'Other',
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  note        TEXT,
  jira_ids    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS employees_name_key ON employees (lower(name));

-- One row per Jira worklog. day = the date the work was logged against (in the logger's own time).
CREATE TABLE IF NOT EXISTS worklogs (
  id          TEXT PRIMARY KEY,
  issue_key   TEXT NOT NULL,
  summary     TEXT,
  project     TEXT,
  author_id   TEXT NOT NULL,
  author_name TEXT,
  day         DATE NOT NULL,
  hours       NUMERIC(7,3) NOT NULL,
  comment     TEXT
);
CREATE INDEX IF NOT EXISTS worklogs_day_idx ON worklogs (day);
CREATE INDEX IF NOT EXISTS worklogs_author_idx ON worklogs (author_id);

CREATE TABLE IF NOT EXISTS leave (
  employee_id INT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  day         DATE NOT NULL,
  hours       NUMERIC(4,2) NOT NULL,
  note        TEXT,
  PRIMARY KEY (employee_id, day)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
INSERT INTO settings (key, value) VALUES
  ('hours_per_day', '7'),
  ('sprint_anchor', '"2026-10-12"'),
  ('sprint_anchor_number', '63')
ON CONFLICT (key) DO NOTHING;

-- Who changed what (also created on first use by the site)
CREATE TABLE IF NOT EXISTS audit_log (
  id     BIGSERIAL PRIMARY KEY,
  at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  data   JSONB
);

-- Recycle bin: everything deleted on the site is copied here (also created on first use)
CREATE TABLE IF NOT EXISTS recycle_bin (
  id          BIGSERIAL PRIMARY KEY,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  label       TEXT NOT NULL,
  detail      TEXT,
  data        JSONB NOT NULL,
  restored_at TIMESTAMPTZ,
  restored_by TEXT
);

-- Sign-in history (admin only to view; also created on first use by the site)
CREATE TABLE IF NOT EXISTS login_log (
  id    BIGSERIAL PRIMARY KEY,
  at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  email TEXT NOT NULL,
  event TEXT NOT NULL,
  role  TEXT
);

-- Sample roster (fictional people) and a few public holidays, for trying the app out.
-- Re-running skips names that already exist.
INSERT INTO employees (name, emp_no, team, active, note, jira_ids) VALUES
  ('Alex Morgan', 'E001', 'Alpha', TRUE, NULL, '{}'::text[]),
  ('Sam Rivera', 'E002', 'Alpha', TRUE, NULL, '{}'::text[]),
  ('Jamie Chen', 'E003', 'Alpha', TRUE, NULL, '{}'::text[]),
  ('Priya Nair', 'E004', 'Bravo', TRUE, NULL, '{}'::text[]),
  ('Leo Fischer', 'E005', 'Bravo', TRUE, NULL, '{}'::text[]),
  ('Maya Okafor', 'E006', 'Bravo', TRUE, NULL, '{}'::text[]),
  ('Noah Silva', 'E007', 'Charlie', TRUE, NULL, '{}'::text[]),
  ('Zoe Kim', 'E008', 'Charlie', TRUE, NULL, '{}'::text[]),
  ('Omar Haddad', 'E009', 'Support', TRUE, NULL, '{}'::text[])
ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('holidays', '[{"date": "2026-01-01", "name": "New Year''s Day"}, {"date": "2026-12-25", "name": "Christmas Day"}]'::jsonb) ON CONFLICT (key) DO NOTHING;

-- Fictional worklogs for the public demo: the last ~10 weeks of working days for the sample roster.
-- Run after schema.sql and seed.sql. Safe to run again.
UPDATE employees SET jira_ids = ARRAY['demo-' || id::text] WHERE emp_no ~ '^E00[0-9]$';

INSERT INTO worklogs (id, issue_key, summary, project, author_id, author_name, day, hours, comment)
SELECT
  e.id || '-' || d::date,
  p.key || '-' || (100 + (abs(hashtext(e.id::text || d::text)) % 40)),
  p.summary,
  p.name,
  'demo-' || e.id,
  e.name,
  d::date,
  5 + (abs(hashtext(d::text || e.name)) % 5) * 0.5,
  NULL
FROM employees e
CROSS JOIN generate_series(current_date - 70, current_date, interval '1 day') d
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    (0, 'PORT', 'Customer Portal', 'Build account settings page'),
    (1, 'APP',  'Mobile App',      'Fix push notification delivery'),
    (2, 'DATA', 'Data Platform',   'Optimise nightly import job')
  ) v(i, key, name, summary) WHERE v.i = abs(hashtext(e.id::text || d::text)) % 3
) p
WHERE e.emp_no ~ '^E00[0-9]$'
  AND extract(isodow FROM d) < 6
  AND abs(hashtext(e.name || d::text)) % 11 <> 0
ON CONFLICT (id) DO NOTHING;
