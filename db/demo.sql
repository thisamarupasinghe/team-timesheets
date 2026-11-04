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
