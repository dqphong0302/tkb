import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

const pk = () => integer('id').primaryKey({ autoIncrement: true })
const schoolId = () => integer('school_id').notNull()
const semesterId = () => integer('semester_id').notNull()

export const school = sqliteTable('school', {
  id: pk(),
  name: text('name').notNull(),
  address: text('address').notNull().default(''),
  principal: text('principal').notNull().default(''),
  maxPeriodsPerWeek: integer('max_periods_per_week').notNull().default(0),
  createdAt: integer('created_at').notNull()
})

export const academicYear = sqliteTable('academic_year', {
  id: pk(),
  schoolId: schoolId(),
  name: text('name').notNull()
})

export const semester = sqliteTable('semester', {
  id: pk(),
  schoolId: schoolId(),
  academicYearId: integer('academic_year_id').notNull(),
  name: text('name').notNull(),
  orderNo: integer('order_no').notNull().default(1),
  startDate: text('start_date').notNull().default(''),
  endDate: text('end_date').notNull().default(''),
  isActive: integer('is_active').notNull().default(0)
})

export const grade = sqliteTable('grade', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  name: text('name').notNull(),
  orderNo: integer('order_no').notNull().default(0)
})

export const room = sqliteTable('room', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('normal'),
  capacity: integer('capacity').notNull().default(0),
  note: text('note').notNull().default('')
})

export const schoolClass = sqliteTable('school_class', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  gradeId: integer('grade_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  shift: text('shift').notNull().default('morning'),
  maxPeriodsPerDay: integer('max_periods_per_day').notNull().default(5),
  roomId: integer('room_id'),
  orderNo: integer('order_no').notNull().default(0)
})

export const teachingDay = sqliteTable('teaching_day', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  weekday: integer('weekday').notNull(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1)
})

export const period = sqliteTable('period', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  shift: text('shift').notNull().default('morning'),
  orderNo: integer('order_no').notNull(),
  name: text('name').notNull(),
  startTime: text('start_time').notNull().default(''),
  endTime: text('end_time').notNull().default('')
})

export const subject = sqliteTable('subject', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3b82f6'),
  orderNo: integer('order_no').notNull().default(0),
  allowDouble: integer('allow_double').notNull().default(0),
  maxPerDay: integer('max_per_day').notNull().default(2),
  minGapDays: integer('min_gap_days').notNull().default(0),
  requiresSpecialRoom: integer('requires_special_room').notNull().default(0),
  roomId: integer('room_id')
})

export const teacher = sqliteTable('teacher', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  code: text('code').notNull(),
  fullName: text('full_name').notNull(),
  shortName: text('short_name').notNull().default(''),
  department: text('department').notNull().default(''),
  color: text('color').notNull().default('#10b981'),
  maxPeriodsPerDay: integer('max_periods_per_day').notNull().default(5),
  avoidGaps: integer('avoid_gaps').notNull().default(0),
  note: text('note').notNull().default('')
})

export const homeroomAssignment = sqliteTable('homeroom_assignment', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  classId: integer('class_id').notNull(),
  teacherId: integer('teacher_id').notNull()
})

export const teachingAssignment = sqliteTable('teaching_assignment', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  classId: integer('class_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  teacherId: integer('teacher_id'),
  periodsPerWeek: integer('periods_per_week').notNull().default(0),
  doublePeriods: integer('double_periods').notNull().default(0),
  doubleRequired: integer('double_required').notNull().default(0),
  roomId: integer('room_id'),
  note: text('note').notNull().default('')
})

export const subjectGrade = sqliteTable('subject_grade', {
  id: pk(),
  subjectId: integer('subject_id').notNull(),
  gradeId: integer('grade_id').notNull()
})

export const teacherAvailability = sqliteTable('teacher_availability', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  teacherId: integer('teacher_id').notNull(),
  dayId: integer('day_id').notNull(),
  periodId: integer('period_id').notNull(),
  status: text('status').notNull().default('busy')
})

export const classAvailability = sqliteTable('class_availability', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  classId: integer('class_id').notNull(),
  dayId: integer('day_id').notNull(),
  periodId: integer('period_id').notNull(),
  status: text('status').notNull().default('off')
})

export const roomAvailability = sqliteTable('room_availability', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  roomId: integer('room_id').notNull(),
  dayId: integer('day_id').notNull(),
  periodId: integer('period_id').notNull(),
  status: text('status').notNull().default('off')
})

export const schedulingConstraint = sqliteTable('scheduling_constraint', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  key: text('key').notNull(),
  level: text('level').notNull().default('medium')
})

export const timetable = sqliteTable('timetable', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(0),
  score: real('score').notNull().default(0),
  note: text('note').notNull().default(''),
  createdAt: integer('created_at').notNull()
})

export const timetableEntry = sqliteTable('timetable_entry', {
  id: pk(),
  timetableId: integer('timetable_id').notNull(),
  classId: integer('class_id').notNull(),
  subjectId: integer('subject_id').notNull(),
  teacherId: integer('teacher_id'),
  roomId: integer('room_id'),
  dayId: integer('day_id').notNull(),
  periodId: integer('period_id').notNull(),
  assignmentId: integer('assignment_id'),
  locked: integer('locked').notNull().default(0)
})

export const solverJob = sqliteTable('solver_job', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: semesterId(),
  status: text('status').notNull().default('idle'),
  scope: text('scope').notNull().default('school'),
  mode: text('mode').notNull().default('full'),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
  resultTimetableId: integer('result_timetable_id'),
  message: text('message').notNull().default('')
})

export const solverViolation = sqliteTable('solver_violation', {
  id: pk(),
  jobId: integer('job_id').notNull(),
  kind: text('kind').notNull(),
  ruleKey: text('rule_key').notNull().default(''),
  message: text('message').notNull().default(''),
  weight: real('weight').notNull().default(0)
})

export const backupRecord = sqliteTable('backup_record', {
  id: pk(),
  schoolId: schoolId(),
  semesterId: integer('semester_id'),
  filePath: text('file_path').notNull(),
  appVersion: text('app_version').notNull().default(''),
  createdAt: integer('created_at').notNull()
})
