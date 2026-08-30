import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { and, eq, inArray } from 'drizzle-orm'
import * as schema from './db/schema'
import { CONSTRAINT_PRESETS } from '../shared/constants'

console.log('=== BẮT ĐẦU KIỂM THỬ TÍCH HỢP TOÀN BỘ BACKEND & PREFLIGHT CHECKS ===\n')

const testDbPath = join(process.cwd(), 'test_temp.db')
if (existsSync(testDbPath)) unlinkSync(testDbPath)

const sqlite = new Database(testDbPath)
sqlite.pragma('foreign_keys = ON')

// Run migrations
const m1 = readFileSync(join(process.cwd(), 'src/main/db/migrations/0001_init.sql'), 'utf-8')
const m2 = readFileSync(join(process.cwd(), 'src/main/db/migrations/0002_school_max_periods.sql'), 'utf-8')
const m3 = readFileSync(join(process.cwd(), 'src/main/db/migrations/0003_subject_grade.sql'), 'utf-8')

sqlite.exec(m1)
sqlite.exec(m2)
sqlite.exec(m3)

const db = drizzle(sqlite, { schema })
console.log('✓ Khởi tạo SQLite và chạy 3 migrations thành công.')

// 1. Test School & Academic Year & Semester creation
const school = db.insert(schema.school).values({
  name: 'Trường Tiểu học & THCS Thực Nghiệm',
  address: 'Hà Nội',
  principal: 'Thầy Hiệu Trưởng',
  maxPeriodsPerWeek: 20,
  createdAt: Date.now()
}).returning().get()

const year = db.insert(schema.academicYear).values({
  schoolId: school.id,
  name: '2026-2027'
}).returning().get()

const semester = db.insert(schema.semester).values({
  schoolId: school.id,
  academicYearId: year.id,
  name: 'Học kỳ 1',
  orderNo: 1,
  isActive: 1
}).returning().get()

console.log(`✓ Đã tạo Trường (id: ${school.id}), Năm học (id: ${year.id}), Học kỳ (id: ${semester.id}).`)

// 2. Test Days & Period Template (Primary School: 4 sáng + 3 chiều = 7 tiết/ngày)
for (let w = 2; w <= 6; w++) {
  db.insert(schema.teachingDay).values({
    schoolId: school.id,
    semesterId: semester.id,
    weekday: w,
    name: `Thứ ${w}`,
    isActive: 1
  }).run()
}

// Seed Primary periods (4 morning + 3 afternoon)
const primaryMorning = [
  { shift: 'morning' as const, orderNo: 1, name: 'Tiết 1', startTime: '07:30', endTime: '08:05' },
  { shift: 'morning' as const, orderNo: 2, name: 'Tiết 2', startTime: '08:15', endTime: '08:50' },
  { shift: 'morning' as const, orderNo: 3, name: 'Tiết 3', startTime: '09:15', endTime: '09:50' },
  { shift: 'morning' as const, orderNo: 4, name: 'Tiết 4', startTime: '10:00', endTime: '10:35' }
]
const primaryAfternoon = [
  { shift: 'afternoon' as const, orderNo: 1, name: 'Tiết 1', startTime: '14:00', endTime: '14:35' },
  { shift: 'afternoon' as const, orderNo: 2, name: 'Tiết 2', startTime: '14:45', endTime: '15:20' },
  { shift: 'afternoon' as const, orderNo: 3, name: 'Tiết 3', startTime: '15:35', endTime: '16:10' }
]

for (const p of [...primaryMorning, ...primaryAfternoon]) {
  db.insert(schema.period).values({
    schoolId: school.id,
    semesterId: semester.id,
    ...p
  }).run()
}

const loadedPeriods = db.select().from(schema.period).where(eq(schema.period.semesterId, semester.id)).all()
if (loadedPeriods.length !== 7) throw new Error(`Lỗi: kỳ vọng 7 tiết tiểu học nhưng nhận được ${loadedPeriods.length}`)
console.log('✓ Khởi tạo 7 tiết Tiểu học (4 sáng, 3 chiều) thành công.')

// 3. Test Constraints Management & Presets
const presetPrimary = CONSTRAINT_PRESETS.find(p => p.id === 'primary')!
const constraintItems = [
  { key: 'teacherGaps', level: String(presetPrimary.weights.teacherGaps) },
  { key: 'subjectSpread', level: String(presetPrimary.weights.subjectSpread) },
  { key: 'teacherPrefer', level: String(presetPrimary.weights.teacherPrefer) },
  { key: 'avoidSinglePeriod', level: String(presetPrimary.weights.avoidSinglePeriod) },
  { key: 'softDoublePairs', level: String(presetPrimary.weights.softDoublePairs) },
  { key: 'timeLimit', level: String(presetPrimary.timeLimit) },
  { key: 'mode', level: presetPrimary.mode },
  { key: 'presetId', level: presetPrimary.id }
]

for (const it of constraintItems) {
  db.insert(schema.schedulingConstraint).values({
    schoolId: school.id,
    semesterId: semester.id,
    key: it.key,
    level: it.level
  }).run()
}

const loadedConstraints = db.select().from(schema.schedulingConstraint).where(eq(schema.schedulingConstraint.semesterId, semester.id)).all()
if (loadedConstraints.length !== 8) throw new Error(`Lỗi: kỳ vọng 8 constraints nhưng nhận được ${loadedConstraints.length}`)
console.log('✓ Lưu và nạp 8 thiết lập ràng buộc/preset từ database thành công.')

// 4. Test Preflight Validation Logic Function
function runPreflightCheck(semId: number, classIds: number[]): string[] {
  const issues: string[] = []
  const days = db.select().from(schema.teachingDay).where(and(eq(schema.teachingDay.semesterId, semId), eq(schema.teachingDay.isActive, 1))).all()
  const classes = db.select().from(schema.schoolClass).where(and(eq(schema.schoolClass.semesterId, semId), inArray(schema.schoolClass.id, classIds))).all()
  const assignments = db.select().from(schema.teachingAssignment).where(and(eq(schema.teachingAssignment.semesterId, semId), inArray(schema.teachingAssignment.classId, classIds))).all()
  const teachers = db.select().from(schema.teacher).where(eq(schema.teacher.semesterId, semId)).all()
  const subjects = db.select().from(schema.subject).where(eq(schema.subject.semesterId, semId)).all()
  const rooms = db.select().from(schema.room).where(eq(schema.room.semesterId, semId)).all()
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
  const busyByTeacher = db.select().from(schema.teacherAvailability).where(eq(schema.teacherAvailability.status, 'busy')).all()

  for (const a of assignments) {
    if (a.periodsPerWeek <= 0) issues.push(`Phân công id ${a.id} có số tiết mỗi tuần bằng 0.`)
    if (!a.teacherId) issues.push(`Phân công id ${a.id} chưa có giáo viên phụ trách.`)
    const subject = subjectById.get(a.subjectId)
    if (a.doubleRequired && a.doublePeriods <= 0) {
      issues.push(`Phân công id ${a.id} yêu cầu tiết đôi nhưng chưa đặt số tiết đôi.`)
    }
    if (a.doublePeriods > 0 && subject?.allowDouble !== 1) {
      issues.push(`Môn ${subject?.name ?? a.subjectId} chưa cho phép tiết đôi nhưng phân công có tiết đôi.`)
    }
    if (subject?.requiresSpecialRoom === 1 && !a.roomId && !subject.roomId) {
      issues.push(`Môn ${subject.name} yêu cầu phòng chuyên môn nhưng chưa chọn phòng mặc định hoặc phòng trong phân công.`)
    }
  }

  const specialRoomCount = rooms.filter((r) => r.kind === 'special').length
  const periodsCount = db.select().from(schema.period).where(eq(schema.period.semesterId, semId)).all().length
  const specialSubjectIds = new Set(subjects.filter((s) => s.requiresSpecialRoom === 1).map((s) => s.id))
  const specialNeeded = assignments
    .filter((a) => specialSubjectIds.has(a.subjectId))
    .reduce((s, a) => s + a.periodsPerWeek, 0)
  if (specialNeeded > 0) {
    const capacity = specialRoomCount * days.length * periodsCount
    if (specialRoomCount === 0) {
      issues.push('Có môn yêu cầu phòng chuyên môn nhưng chưa khai báo phòng chuyên môn nào.')
    } else if (specialNeeded > capacity) {
      issues.push(`Tổng số tiết cần phòng chuyên môn (${specialNeeded}) vượt sức chứa thời gian của nhóm phòng chuyên môn (${capacity}).`)
    }
  }

  for (const c of classes) {
    const total = assignments.filter((a) => a.classId === c.id).reduce((s, a) => s + a.periodsPerWeek, 0)
    const available = days.length * c.maxPeriodsPerDay
    if (total > available) {
      issues.push(`Lớp ${c.code}: tổng số tiết phân công (${total}) vượt số ô khả dụng của lớp (${available}).`)
    }
  }

  for (const t of teachers) {
    const own = assignments.filter((a) => a.teacherId === t.id)
    if (own.length === 0) continue
    const total = own.reduce((s, a) => s + a.periodsPerWeek, 0)
    const busyCount = busyByTeacher.filter((b) => b.teacherId === t.id).length
    const available = days.length * t.maxPeriodsPerDay - busyCount
    if (total > available) {
      issues.push(`Giáo viên ${t.code}: tổng số tiết phân công (${total}) vượt số ô mà giáo viên rảnh (${Math.max(available, 0)}).`)
    }
  }

  return issues
}

// 5. Test Preflight under various violation scenarios
const grade = db.insert(schema.grade).values({ schoolId: school.id, semesterId: semester.id, name: 'Khối 1', orderNo: 1 }).returning().get()
const cls1 = db.insert(schema.schoolClass).values({ schoolId: school.id, semesterId: semester.id, gradeId: grade.id, code: '1A', name: 'Lớp 1A', shift: 'full', maxPeriodsPerDay: 7 }).returning().get()
const teacher1 = db.insert(schema.teacher).values({ schoolId: school.id, semesterId: semester.id, code: 'GV01', fullName: 'Nguyễn Văn A', maxPeriodsPerDay: 5 }).returning().get()
const subjToan = db.insert(schema.subject).values({ schoolId: school.id, semesterId: semester.id, code: 'TOAN', name: 'Toán', allowDouble: 1, maxPerDay: 2 }).returning().get()
const subjTin = db.insert(schema.subject).values({ schoolId: school.id, semesterId: semester.id, code: 'TIN', name: 'Tin học', allowDouble: 0, requiresSpecialRoom: 1 }).returning().get()

// Scenario A: Valid assignment
const a1 = db.insert(schema.teachingAssignment).values({
  schoolId: school.id,
  semesterId: semester.id,
  classId: cls1.id,
  subjectId: subjToan.id,
  teacherId: teacher1.id,
  periodsPerWeek: 4,
  doublePeriods: 1,
  doubleRequired: 1
}).returning().get()

let issues = runPreflightCheck(semester.id, [cls1.id])
if (issues.length !== 0) throw new Error(`Lỗi preflight không mong đợi trên dữ liệu hợp lệ: ${issues.join(', ')}`)
console.log('✓ Preflight Check: Dữ liệu chuẩn kiểm tra hợp lệ thành công (0 cảnh báo).')

// Scenario B: Missing teacher
const a2 = db.insert(schema.teachingAssignment).values({
  schoolId: school.id,
  semesterId: semester.id,
  classId: cls1.id,
  subjectId: subjTin.id,
  teacherId: null,
  periodsPerWeek: 2,
  doublePeriods: 0,
  doubleRequired: 0
}).returning().get()

issues = runPreflightCheck(semester.id, [cls1.id])
if (!issues.some(i => i.includes('chưa có giáo viên'))) throw new Error('Preflight không bắt được lỗi thiếu giáo viên')
if (!issues.some(i => i.includes('yêu cầu phòng chuyên môn'))) throw new Error('Preflight không bắt được lỗi thiếu phòng chuyên môn')
console.log('✓ Preflight Check: Bắt chính xác lỗi thiếu giáo viên và thiếu phòng chuyên môn.')

// Clean up invalid assignment a2
db.delete(schema.teachingAssignment).where(eq(schema.teachingAssignment.id, a2.id)).run()

// Scenario C: Class capacity overload (e.g. 40 periods when class only has 5 days * 7 = 35 capacity)
const subjVan = db.insert(schema.subject).values({ schoolId: school.id, semesterId: semester.id, code: 'VAN', name: 'Ngữ văn' }).returning().get()
const a3 = db.insert(schema.teachingAssignment).values({
  schoolId: school.id,
  semesterId: semester.id,
  classId: cls1.id,
  subjectId: subjVan.id,
  teacherId: teacher1.id,
  periodsPerWeek: 35,
  doublePeriods: 0,
  doubleRequired: 0
}).returning().get()

issues = runPreflightCheck(semester.id, [cls1.id])
if (!issues.some(i => i.includes('vượt số ô khả dụng của lớp'))) throw new Error('Preflight không bắt được lỗi vượt sức chứa của lớp')
if (!issues.some(i => i.includes('vượt số ô mà giáo viên rảnh'))) throw new Error('Preflight không bắt được lỗi vượt tải giáo viên')
console.log('✓ Preflight Check: Bắt chính xác lỗi vượt quá số tiết tối đa của Lớp và Giáo viên.')

// Clean up a3
db.delete(schema.teachingAssignment).where(eq(schema.teachingAssignment.id, a3.id)).run()

// 6. Test Timetable & Entries & Locking
const tt = db.insert(schema.timetable).values({
  schoolId: school.id,
  semesterId: semester.id,
  name: 'Phương án 1 (Tự động)',
  isActive: 1,
  score: 100,
  createdAt: Date.now()
}).returning().get()

const entry = db.insert(schema.timetableEntry).values({
  timetableId: tt.id,
  classId: cls1.id,
  subjectId: subjToan.id,
  teacherId: teacher1.id,
  dayId: 1,
  periodId: 1,
  assignmentId: a1.id,
  locked: 0
}).returning().get()

// Toggle lock
db.update(schema.timetableEntry).set({ locked: 1 }).where(eq(schema.timetableEntry.id, entry.id)).run()
const updatedEntry = db.select().from(schema.timetableEntry).where(eq(schema.timetableEntry.id, entry.id)).get()
if (updatedEntry?.locked !== 1) throw new Error('Lỗi khóa tiết trên thời khóa biểu')
console.log('✓ Thao tác Thời khóa biểu: Tạo phương án, xếp tiết và Khóa tiết (🔒) thành công.')

// Clean up test db file
sqlite.close()
unlinkSync(testDbPath)
console.log('\n=== TẤT CẢ TEST CASES TÍCH HỢP ĐỀU VƯỢT QUA 100% THÀNH CÔNG! ===')
