INSERT INTO recognition_values (name, description, color) VALUES
  ('Customer focus', 'Recognising work that puts the client experience first.', '#0ea5e9'),
  ('Teamwork & collaboration', 'Recognising help given, knowledge shared and shared wins.', '#f59e0b'),
  ('Ownership & accountability', 'Recognising people who take responsibility and see things through.', '#dc2626'),
  ('Integrity', 'Recognising honest, principled choices, even when they are hard.', '#475569'),
  ('Growth mindset', 'Recognising learning, curiosity and improvement over time.', '#14b8a6')
ON CONFLICT (name) DO NOTHING;
