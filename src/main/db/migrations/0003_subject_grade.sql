CREATE TABLE subject_grade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  grade_id INTEGER NOT NULL REFERENCES grade(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX subject_grade_uq ON subject_grade(subject_id, grade_id);
