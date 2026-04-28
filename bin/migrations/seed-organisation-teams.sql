-- Seed organisation_teams with the 7 SLK Ressorts
-- Safe to run multiple times (ON CONFLICT DO NOTHING)

INSERT INTO organisation_teams (id, sort, team_key, label, email, color, tasks) VALUES
  (gen_random_uuid(), 1, 'lokalteams', 'Lokalteams / Netzwerk', 'community@stadt-land-klima.de', '#1ea64a',
   '["Onboarding","Betreuung von Lokalteams","Kooperationen & Unterstützung","Veranstaltungen (Teilnahme & Organisation)"]'),
  (gen_random_uuid(), 2, 'technik', 'Technik & IT', 'dev@stadt-land-klima.de', '#afca0b',
   '["Web-App (Frontend, Backend, Logik, GitHub, Chatbot, API)","UI/UX-Design","IT-Infrastruktur (Cal- u. Mail-Server, Cloud, Wechange)"]'),
  (gen_random_uuid(), 3, 'steuerkreis', 'Steuerkreis', 'info@stadt-land-klima.de', '#fddd00',
   '["Planung und Strategieentwicklung","Fundraising / Förderung / Spenden","Projektkoordination & -umsetzung","Koordinierung der Projekt- und Arbeitsgruppen"]'),
  (gen_random_uuid(), 4, 'massnahmen', 'Maßnahmen', 'massnahmen@stadt-land-klima.de', '#16bae7',
   '["Maßnahmenentwicklung & -evaluation","Qualitätssicherung","Peer Review Kommunen"]'),
  (gen_random_uuid(), 5, 'kommunikation', 'Kommunikation / Öffentlichkeitsarbeit', 'presse@stadt-land-klima.de', '#f39200',
   '["Presse- und Öffentlichkeitsarbeit","Social Media, Newsletter","Webredaktion","Redaktion Erfolgsprojekte, Wiki Design"]'),
  (gen_random_uuid(), 6, 'vorstand', 'Vorstand / Verwaltung', 'verein@stadt-land-klima.de', '#9d9d9c',
   '["Mitgliederbetreuung","Mitgliederversammlung","Rechtliches","Finanzen"]'),
  (gen_random_uuid(), 7, 'kassenwart', 'Kassenwart', 'kassenwart@stadt-land-klima.de', '#9c5cc4',
   '["Buchführung & Jahresabschluss","Mitgliedsbeiträge","Spendenverwaltung","Finanzberichte & Kassenprüfung"]')
ON CONFLICT (team_key) DO NOTHING;
