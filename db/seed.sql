-- Fictional roster for the public demo: every name, number and email is made up.
-- Jira account ids are placeholders (demo-E001 ...). Re-running skips names that already exist.
INSERT INTO employees (name, emp_no, email, team, active, note, jira_ids) VALUES
  ('Alex Morgan', 'E001', 'alex.morgan@example.com', 'Alpha', TRUE, NULL, ARRAY['demo-E001']::text[]),
  ('Sam Rivera', 'E002', 'sam.rivera@example.com', 'Alpha', TRUE, NULL, ARRAY['demo-E002']::text[]),
  ('Jamie Chen', 'E003', 'jamie.chen@example.com', 'Alpha', TRUE, NULL, ARRAY['demo-E003']::text[]),
  ('Jordan Blake', 'E004', 'jordan.blake@example.com', 'Alpha', TRUE, NULL, ARRAY['demo-E004']::text[]),
  ('Priya Nair', 'E005', 'priya.nair@example.com', 'Alpha', TRUE, NULL, ARRAY['demo-E005']::text[]),
  ('Leo Fischer', 'E006', 'leo.fischer@example.com', 'Bravo', TRUE, NULL, ARRAY['demo-E006']::text[]),
  ('Maya Okafor', 'E007', 'maya.okafor@example.com', 'Bravo', TRUE, NULL, ARRAY['demo-E007']::text[]),
  ('Noah Becker', 'E008', 'noah.becker@example.com', 'Bravo', TRUE, NULL, ARRAY['demo-E008']::text[]),
  ('Ines Duarte', 'E009', 'ines.duarte@example.com', 'Bravo', TRUE, NULL, ARRAY['demo-E009']::text[]),
  ('Kofi Mensah', 'E010', 'kofi.mensah@example.com', 'Bravo', TRUE, NULL, ARRAY['demo-E010']::text[]),
  ('Ava Lindqvist', 'E011', 'ava.lindqvist@example.com', 'Charlie', TRUE, NULL, ARRAY['demo-E011']::text[]),
  ('Ravi Menon', 'E012', 'ravi.menon@example.com', 'Charlie', TRUE, NULL, ARRAY['demo-E012']::text[]),
  ('Zoe Alvarez', 'E013', 'zoe.alvarez@example.com', 'Charlie', TRUE, NULL, ARRAY['demo-E013']::text[]),
  ('Ethan Wu', 'E014', 'ethan.wu@example.com', 'Charlie', TRUE, NULL, ARRAY['demo-E014']::text[]),
  ('Hana Sato', 'E015', 'hana.sato@example.com', 'Delta', TRUE, NULL, ARRAY['demo-E015']::text[]),
  ('Marcus Reid', 'E016', 'marcus.reid@example.com', 'Delta', TRUE, NULL, ARRAY['demo-E016']::text[]),
  ('Lucia Ferrari', 'E017', 'lucia.ferrari@example.com', 'Delta', TRUE, NULL, ARRAY['demo-E017']::text[]),
  ('Omar Haddad', 'E018', 'omar.haddad@example.com', 'Delta', TRUE, NULL, ARRAY['demo-E018']::text[]),
  ('Freya Nilsson', 'E019', 'freya.nilsson@example.com', 'Echo', TRUE, NULL, ARRAY['demo-E019']::text[]),
  ('Tomas Silva', 'E020', 'tomas.silva@example.com', 'Echo', TRUE, NULL, ARRAY['demo-E020']::text[]),
  ('Aisha Khan', 'E021', 'aisha.khan@example.com', 'Echo', TRUE, NULL, ARRAY['demo-E021']::text[]),
  ('Daniel Okoye', 'E022', 'daniel.okoye@example.com', 'Echo', TRUE, NULL, ARRAY['demo-E022']::text[]),
  ('Elena Petrova', 'E023', 'elena.petrova@example.com', 'Platform', TRUE, NULL, ARRAY['demo-E023']::text[]),
  ('Chris Walker', 'E024', 'chris.walker@example.com', 'Platform', TRUE, NULL, ARRAY['demo-E024']::text[]),
  ('Nina Rossi', 'E025', 'nina.rossi@example.com', 'Studio', TRUE, NULL, ARRAY['demo-E025']::text[]),
  ('Robert Hale', 'E026', 'robert.hale@example.com', 'Group', TRUE, NULL, '{}'::text[]),
  ('Claire Dubois', 'E027', 'claire.dubois@example.com', 'Finance', TRUE, NULL, '{}'::text[]),
  ('Grace Turner', 'E028', 'grace.turner@example.com', 'HR', TRUE, NULL, '{}'::text[]),
  ('Victor Stone', 'E029', 'victor.stone@example.com', 'Other', FALSE, 'Yet to join', '{}'::text[])
ON CONFLICT DO NOTHING;
INSERT INTO settings (key, value) VALUES ('holidays', '[{"date":"2026-01-01","name":"New Year''s Day"},{"date":"2026-04-03","name":"Good Friday"},{"date":"2026-04-06","name":"Easter Monday"},{"date":"2026-05-01","name":"Labour Day"},{"date":"2026-12-24","name":"Christmas Eve"},{"date":"2026-12-25","name":"Christmas Day"},{"date":"2026-12-28","name":"Winter Break"},{"date":"2026-12-31","name":"New Year''s Eve"}]'::jsonb) ON CONFLICT (key) DO NOTHING;
