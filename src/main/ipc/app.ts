import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle } from './util'
import type { Bootstrap } from '@shared/types'
import { WEEKDAYS } from '@shared/constants'

const MORNING = [
  ['Tiết 1', '07:00', '07:45'],
  ['Tiết 2', '07:50', '08:35'],
  ['Tiết 3', '08:50', '09:35'],
  ['Tiết 4', '09:40', '10:25'],
  ['Tiết 5', '10:30', '11:15']
]
const AFTERNOON = [
  ['Tiết 1', '13:30', '14:15'],
  ['Tiết 2', '14:20', '15:05'],
  ['Tiết 3', '15:20', '16:05'],
  ['Tiết 4', '16:10', '16:55'],
  ['Tiết 5', '17:00', '17:45']
]

function seedCalendar(schoolId: number, semesterId: number): void {
  const days = WEEKDAYS.map((d) => ({
    schoolId,
    semesterId,
    weekday: d.weekday,
    name: d.name,
    isActive: d.weekday <= 7 ? 1 : 0
  }))
  db().insert(schema.teachingDay).values(days).run()

  const periods = [
    ...MORNING.map((p, i) => ({ shift: 'morning', orderNo: i + 1, name: p[0], startTime: p[1], endTime: p[2] })),
    ...AFTERNOON.map((p, i) => ({ shift: 'afternoon', orderNo: i + 1, name: p[0], startTime: p[1], endTime: p[2] }))
  ].map((p) => ({ ...p, schoolId, semesterId }))
  db().insert(schema.period).values(periods).run()
}

function readBootstrap(): Bootstrap {
  const school = db().select().from(schema.school).limit(1).get() ?? null
  if (!school) return { school: null, semester: null, years: [], semesters: [] }
  const years = db()
    .select()
    .from(schema.academicYear)
    .where(eq(schema.academicYear.schoolId, school.id))
    .orderBy(asc(schema.academicYear.id))
    .all()
  const semesters = db()
    .select()
    .from(schema.semester)
    .where(eq(schema.semester.schoolId, school.id))
    .orderBy(asc(schema.semester.academicYearId), asc(schema.semester.orderNo))
    .all()
  const semester = semesters.find((s) => s.isActive === 1) ?? semesters[0] ?? null
  return { school, semester, years, semesters } as Bootstrap
}

const setupSchema = z.object({
  schoolName: z.string().trim().min(1, 'Tên trường không được để trống'),
  yearName: z.string().trim().min(1, 'Tên năm học không được để trống'),
  semesterName: z.string().trim().min(1, 'Tên học kỳ không được để trống')
})

export function registerAppHandlers(): void {
  handle('app:bootstrap', () => readBootstrap())

  handle('app:setup', (payload) => {
    const input = setupSchema.parse(payload)
    if (db().select().from(schema.school).limit(1).get()) {
      throw new Error('Trường đã được khởi tạo.')
    }
    const school = db()
      .insert(schema.school)
      .values({ name: input.schoolName, createdAt: Date.now() })
      .returning()
      .get()
    const year = db()
      .insert(schema.academicYear)
      .values({ schoolId: school.id, name: input.yearName })
      .returning()
      .get()
    const semester = db()
      .insert(schema.semester)
      .values({
        schoolId: school.id,
        academicYearId: year.id,
        name: input.semesterName,
        orderNo: 1,
        isActive: 1
      })
      .returning()
      .get()
    seedCalendar(school.id, semester.id)
    return readBootstrap()
  })

  handle('school:update', (payload) => {
    const input = z
      .object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1, 'Tên trường không được để trống'),
        address: z.string().trim().default(''),
        principal: z.string().trim().default(''),
        maxPeriodsPerWeek: z.number().int().min(0).default(0)
      })
      .parse(payload)
    return db()
      .update(schema.school)
      .set({
        name: input.name,
        address: input.address,
        principal: input.principal,
        maxPeriodsPerWeek: input.maxPeriodsPerWeek
      })
      .where(eq(schema.school.id, input.id))
      .returning()
      .get()
  })

  handle('semester:create', (payload) => {
    const input = z
      .object({
        academicYearId: z.number().int().positive(),
        name: z.string().trim().min(1, 'Tên học kỳ không được để trống'),
        orderNo: z.number().int().min(1).default(1)
      })
      .parse(payload)
    const year = db()
      .select()
      .from(schema.academicYear)
      .where(eq(schema.academicYear.id, input.academicYearId))
      .get()
    if (!year) throw new Error('Năm học không tồn tại.')
    const semester = db()
      .insert(schema.semester)
      .values({
        schoolId: year.schoolId,
        academicYearId: year.id,
        name: input.name,
        orderNo: input.orderNo,
        isActive: 0
      })
      .returning()
      .get()
    seedCalendar(year.schoolId, semester.id)
    return semester
  })

  handle('year:create', (payload) => {
    const input = z
      .object({ name: z.string().trim().min(1, 'Tên năm học không được để trống') })
      .parse(payload)
    const school = db().select().from(schema.school).limit(1).get()
    if (!school) throw new Error('Chưa khởi tạo trường.')
    return db()
      .insert(schema.academicYear)
      .values({ schoolId: school.id, name: input.name })
      .returning()
      .get()
  })

  handle('semester:activate', (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    const target = db().select().from(schema.semester).where(eq(schema.semester.id, id)).get()
    if (!target) throw new Error('Học kỳ không tồn tại.')
    db()
      .update(schema.semester)
      .set({ isActive: 0 })
      .where(eq(schema.semester.schoolId, target.schoolId))
      .run()
    db().update(schema.semester).set({ isActive: 1 }).where(eq(schema.semester.id, id)).run()
    return readBootstrap()
  })

  handle('semester:delete', (payload) => {
    const { id } = z.object({ id: z.number().int().positive() }).parse(payload)
    const target = db().select().from(schema.semester).where(eq(schema.semester.id, id)).get()
    if (!target) throw new Error('Học kỳ không tồn tại.')
    const count = db()
      .select()
      .from(schema.semester)
      .where(eq(schema.semester.schoolId, target.schoolId))
      .all().length
    if (count <= 1) throw new Error('Phải giữ lại ít nhất một học kỳ.')
    db().delete(schema.semester).where(eq(schema.semester.id, id)).run()
    const rest = db()
      .select()
      .from(schema.semester)
      .where(and(eq(schema.semester.schoolId, target.schoolId), eq(schema.semester.isActive, 1)))
      .get()
    if (!rest) {
      const first = db()
        .select()
        .from(schema.semester)
        .where(eq(schema.semester.schoolId, target.schoolId))
        .orderBy(asc(schema.semester.id))
        .get()
      if (first) db().update(schema.semester).set({ isActive: 1 }).where(eq(schema.semester.id, first.id)).run()
    }
    return readBootstrap()
  })
}
