CREATE TABLE school (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  principal TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE academic_year (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE semester (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  academic_year_id INTEGER NOT NULL REFERENCES academic_year(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_no INTEGER NOT NULL DEFAULT 1,
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE grade (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_no INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX grade_semester_name_uq ON grade(semester_id, name);

CREATE TABLE room (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'normal',
  capacity INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX room_semester_code_uq ON room(semester_id, code);

CREATE TABLE school_class (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  grade_id INTEGER NOT NULL REFERENCES grade(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'morning',
  max_periods_per_day INTEGER NOT NULL DEFAULT 5,
  room_id INTEGER REFERENCES room(id) ON DELETE SET NULL,
  order_no INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX class_semester_code_uq ON school_class(semester_id, code);

CREATE TABLE teaching_day (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX day_semester_weekday_uq ON teaching_day(semester_id, weekday);

CREATE TABLE period (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  shift TEXT NOT NULL DEFAULT 'morning',
  order_no INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX period_semester_shift_order_uq ON period(semester_id, shift, order_no);

CREATE TABLE subject (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  order_no INTEGER NOT NULL DEFAULT 0,
  allow_double INTEGER NOT NULL DEFAULT 0,
  max_per_day INTEGER NOT NULL DEFAULT 2,
  min_gap_days INTEGER NOT NULL DEFAULT 0,
  requires_special_room INTEGER NOT NULL DEFAULT 0,
  room_id INTEGER REFERENCES room(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX subject_semester_code_uq ON subject(semester_id, code);

CREATE TABLE teacher (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#10b981',
  max_periods_per_day INTEGER NOT NULL DEFAULT 5,
  avoid_gaps INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX teacher_semester_code_uq ON teacher(semester_id, code);

CREATE TABLE homeroom_assignment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES school_class(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teacher(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX homeroom_class_uq ON homeroom_assignment(semester_id, class_id);

CREATE TABLE teaching_assignment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES school_class(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teacher(id) ON DELETE SET NULL,
  periods_per_week INTEGER NOT NULL DEFAULT 0,
  double_periods INTEGER NOT NULL DEFAULT 0,
  double_required INTEGER NOT NULL DEFAULT 0,
  room_id INTEGER REFERENCES room(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX assignment_class_subject_uq ON teaching_assignment(semester_id, class_id, subject_id);

CREATE TABLE teacher_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teacher(id) ON DELETE CASCADE,
  day_id INTEGER NOT NULL REFERENCES teaching_day(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES period(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'busy'
);
CREATE UNIQUE INDEX teacher_avail_uq ON teacher_availability(teacher_id, day_id, period_id);

CREATE TABLE class_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES school_class(id) ON DELETE CASCADE,
  day_id INTEGER NOT NULL REFERENCES teaching_day(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES period(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'off'
);
CREATE UNIQUE INDEX class_avail_uq ON class_availability(class_id, day_id, period_id);

CREATE TABLE room_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES room(id) ON DELETE CASCADE,
  day_id INTEGER NOT NULL REFERENCES teaching_day(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES period(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'off'
);
CREATE UNIQUE INDEX room_avail_uq ON room_availability(room_id, day_id, period_id);

CREATE TABLE scheduling_constraint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'medium'
);
CREATE UNIQUE INDEX constraint_key_uq ON scheduling_constraint(semester_id, key);

CREATE TABLE timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE timetable_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timetable_id INTEGER NOT NULL REFERENCES timetable(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES school_class(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teacher(id) ON DELETE SET NULL,
  room_id INTEGER REFERENCES room(id) ON DELETE SET NULL,
  day_id INTEGER NOT NULL REFERENCES teaching_day(id) ON DELETE CASCADE,
  period_id INTEGER NOT NULL REFERENCES period(id) ON DELETE CASCADE,
  assignment_id INTEGER REFERENCES teaching_assignment(id) ON DELETE CASCADE,
  locked INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX entry_class_slot_uq ON timetable_entry(timetable_id, class_id, day_id, period_id);
CREATE INDEX entry_teacher_slot_ix ON timetable_entry(timetable_id, teacher_id, day_id, period_id);

CREATE TABLE solver_job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER NOT NULL REFERENCES semester(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'idle',
  scope TEXT NOT NULL DEFAULT 'school',
  mode TEXT NOT NULL DEFAULT 'full',
  started_at INTEGER,
  finished_at INTEGER,
  result_timetable_id INTEGER REFERENCES timetable(id) ON DELETE SET NULL,
  message TEXT NOT NULL DEFAULT ''
);

CREATE TABLE solver_violation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES solver_job(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  rule_key TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  weight REAL NOT NULL DEFAULT 0
);

CREATE TABLE backup_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  semester_id INTEGER REFERENCES semester(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  app_version TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
