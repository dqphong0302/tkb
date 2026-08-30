export type Shift = 'morning' | 'afternoon' | 'full'
export type PeriodShift = 'morning' | 'afternoon'
export type RoomKind = 'normal' | 'special'
export type ConstraintLevel = 'off' | 'low' | 'medium' | 'high'

export interface School {
  id: number
  name: string
  address: string
  principal: string
  maxPeriodsPerWeek: number
  createdAt: number
}

export interface AcademicYear {
  id: number
  schoolId: number
  name: string
}

export interface Semester {
  id: number
  schoolId: number
  academicYearId: number
  name: string
  orderNo: number
  startDate: string
  endDate: string
  isActive: number
}

export interface Grade {
  id: number
  schoolId: number
  semesterId: number
  name: string
  orderNo: number
}

export interface Room {
  id: number
  schoolId: number
  semesterId: number
  code: string
  name: string
  kind: RoomKind
  capacity: number
  note: string
}

export interface SchoolClass {
  id: number
  schoolId: number
  semesterId: number
  gradeId: number
  code: string
  name: string
  shift: Shift
  maxPeriodsPerDay: number
  roomId: number | null
  orderNo: number
}

export interface TeachingDay {
  id: number
  schoolId: number
  semesterId: number
  weekday: number
  name: string
  isActive: number
}

export interface Period {
  id: number
  schoolId: number
  semesterId: number
  shift: PeriodShift
  orderNo: number
  name: string
  startTime: string
  endTime: string
}

export interface Subject {
  id: number
  schoolId: number
  semesterId: number
  code: string
  name: string
  color: string
  orderNo: number
  allowDouble: number
  maxPerDay: number
  minGapDays: number
  requiresSpecialRoom: number
  roomId: number | null
}

export interface Teacher {
  id: number
  schoolId: number
  semesterId: number
  code: string
  fullName: string
  shortName: string
  department: string
  color: string
  maxPeriodsPerDay: number
  avoidGaps: number
  note: string
}

export interface HomeroomAssignment {
  id: number
  schoolId: number
  semesterId: number
  classId: number
  teacherId: number
}

export interface TeachingAssignment {
  id: number
  schoolId: number
  semesterId: number
  classId: number
  subjectId: number
  teacherId: number | null
  periodsPerWeek: number
  doublePeriods: number
  doubleRequired: number
  roomId: number | null
  note: string
}

export interface Timetable {
  id: number
  schoolId: number
  semesterId: number
  name: string
  isActive: number
  score: number
  note: string
  createdAt: number
}

export interface TimetableEntry {
  id: number
  timetableId: number
  classId: number
  subjectId: number
  teacherId: number | null
  roomId: number | null
  dayId: number
  periodId: number
  assignmentId: number | null
  locked: number
}

export interface AssignmentProgress {
  assignmentId: number
  classId: number
  subjectId: number
  teacherId: number | null
  required: number
  placed: number
}

export interface TimetableProgress {
  items: AssignmentProgress[]
  totalRequired: number
  totalPlaced: number
}

export type SolverJobStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

export interface SolverJob {
  id: number
  schoolId: number
  semesterId: number
  status: SolverJobStatus
  scope: string
  mode: string
  startedAt: number | null
  finishedAt: number | null
  resultTimetableId: number | null
  message: string
}

export interface SolverEntry {
  assignmentId: number
  classId: number
  subjectId: number
  teacherId: number | null
  roomId: number | null
  dayId: number
  periodId: number
}

export interface SolverMissing {
  assignmentId: number
  classId: number
  subjectId: number
  missingCount: number
}

export type SolverScope =
  | { type: 'school' }
  | { type: 'grade'; gradeIds: number[] }
  | { type: 'classes'; classIds: number[] }

export interface SolverWeights {
  teacherGaps: 0 | 1 | 2 | 3
  subjectSpread: 0 | 1 | 2 | 3
  teacherPrefer: 0 | 1 | 2 | 3
  avoidSinglePeriod: 0 | 1 | 2 | 3
  softDoublePairs: 0 | 1 | 2 | 3
}

export interface SchedulingConstraint {
  id: number
  schoolId: number
  semesterId: number
  key: string
  level: string
}

export interface SubjectGrade {
  id: number
  subjectId: number
  gradeId: number
}

export type AvailabilityStatus = 'busy' | 'prefer'

export interface TeacherAvailability {
  id: number
  schoolId: number
  semesterId: number
  teacherId: number
  dayId: number
  periodId: number
  status: AvailabilityStatus
}

export interface Bootstrap {
  school: School | null
  semester: Semester | null
  years: AcademicYear[]
  semesters: Semester[]
}

export type WizardStepKey =
  | 'grade'
  | 'class'
  | 'calendar'
  | 'room'
  | 'subject'
  | 'teacher'
  | 'homeroom'
  | 'assignment'
  | 'periodsPerWeek'

export interface WizardStepStatus {
  key: WizardStepKey
  count: number
  done: boolean
  optional: boolean
  issues: string[]
}
