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
