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
