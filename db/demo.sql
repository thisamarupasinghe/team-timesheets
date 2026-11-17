-- Fictional leave and worklogs for the public demo, always relative to today (about 20 weeks back).
-- Run after the schema and seed. Safe to run again: it only adds what is missing, so the demo stays current.

INSERT INTO leave (employee_id, day, hours, note)
SELECT e.id, d::date, 7, 'Annual leave'
FROM employees e CROSS JOIN generate_series(current_date - 140, current_date + 28, interval '1 day') d
WHERE e.active AND extract(isodow FROM d) < 6 AND abs(hashtext(e.name || d::date::text || 'lv')) % 40 = 0
ON CONFLICT DO NOTHING;

WITH days AS (
  SELECT d::date AS d FROM generate_series(current_date - 140, current_date - 1, interval '1 day') d WHERE extract(isodow FROM d) < 6
), base AS (
  SELECT e.id, e.name, e.team, e.jira_ids[1] AS jid, days.d,
         greatest(3, 5.7 + (abs(hashtext(e.name)) % 6) * 0.4 + ((abs(hashtext(e.name || days.d::text)) % 3) - 1) * 0.5) AS hrs
  FROM employees e CROSS JOIN days
  WHERE e.active AND array_length(e.jira_ids, 1) > 0
    AND NOT EXISTS (SELECT 1 FROM leave l WHERE l.employee_id = e.id AND l.day = days.d)
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce((SELECT value FROM settings WHERE key = 'holidays'), '[]'::jsonb)) h WHERE (h->>'date')::date = days.d)
    AND abs(hashtext(e.name || days.d::text || 'miss')) % 25 <> 0
), proj AS (
  SELECT b.*,
    CASE b.team WHEN 'Alpha' THEN 'ATLAS' WHEN 'Bravo' THEN 'BEACON' WHEN 'Charlie' THEN 'COMET' WHEN 'Delta' THEN 'DRIFT'
                WHEN 'Echo' THEN 'EMBER' WHEN 'Platform' THEN 'PLAT' ELSE 'STUDIO' END AS pk,
    CASE b.team WHEN 'Alpha' THEN 'Atlas Mobile App' WHEN 'Bravo' THEN 'Beacon Billing' WHEN 'Charlie' THEN 'Comet Analytics' WHEN 'Delta' THEN 'Drift Integrations'
                WHEN 'Echo' THEN 'Ember Onboarding' WHEN 'Platform' THEN 'Platform Services' ELSE 'Studio Design System' END AS pn,
    round(b.hrs * 0.65 * 2) / 2 AS h1
  FROM base b
), parts AS (
  SELECT id::text || '-' || d::text || '-a' AS wid, jid, pk || '-' || (100 + abs(hashtext(id::text || d::text)) % 40) AS ik, pn AS project, id, name, d, h1 AS hours,
         (ARRAY['Build the settings screen','Fix pagination on the list view','Review pull requests','Write API tests','Refactor the data layer','Update the onboarding copy','Investigate slow query','Design review follow-ups'])[1 + abs(hashtext(id::text || d::text)) % 8] AS summary
  FROM proj
  UNION ALL
  SELECT id::text || '-' || d::text || '-b', jid, 'OPS-' || (10 + abs(hashtext(name || d::text)) % 20), 'Internal Tooling', id, name, d, hrs - h1,
         (ARRAY['Sprint planning','Stand-ups and syncs','Code review','Deployment support','Documentation','Team retrospective'])[1 + abs(hashtext(name || d::text || 'b')) % 6]
  FROM proj WHERE hrs - h1 > 0
)
INSERT INTO worklogs (id, issue_key, summary, project, author_id, author_name, day, hours, comment)
SELECT wid, ik, summary, project, jid, name, d, hours, NULL FROM parts
ON CONFLICT (id) DO NOTHING;
