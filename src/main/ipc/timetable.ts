import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle, idSchema, semesterScope } from './util'
import { getContext } from './context'

const placeSchema = z.object({
  timetableId: z.number().int().positive(),
  assignmentId: z.number().int().positive(),
  dayId: z.number().int().positive(),
  periodId: z.number().int().positive()
})

const moveSchema = z.object({
  entryId: z.number().int().positive(),
  dayId: z.number().int().positive(),
  periodId: z.number().int().positive()
})

const swapSchema = z.object({
  entryId1: z.number().int().positive(),
  entryId2: z.number().int().positive()
})

function getEntryOrThrow(id: number) {
  const row = db().select().from(schema.timetableEntry).where(eq(schema.timetableEntry.id, id)).get()
  if (!row) throw new Error('Không tìm thấy tiết học.')
  return row
}

interface SlotCheckInput {
  timetableId: number
  classId: number
  teacherId: number | null
  roomId: number | null
  subjectId: number
  assignmentId: number
  dayId: number
  periodId: number
  excludeEntryIds?: number[]
}

function checkSlotValid(input: SlotCheckInput): void {
  const exclude = input.excludeEntryIds ?? []

  const day = db().select().from(schema.teachingDay).where(eq(schema.teachingDay.id, input.dayId)).get()
  if (!day || day.isActive !== 1) throw new Error('Ngày này không phải ngày học trong tuần.')

  const period = db().select().from(schema.period).where(eq(schema.period.id, input.periodId)).get()
  if (!period) throw new Error('Tiết học không tồn tại.')

  const cls = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.id, input.classId)).get()
  if (!cls) throw new Error('Lớp không tồn tại.')
  if (cls.shift !== 'full' && cls.shift !== period.shift) {
    throw new Error('Lớp không học ca này, không thể xếp tiết vào khung giờ đã chọn.')
  }

  const entriesAtSlot = db()
    .select()
    .from(schema.timetableEntry)
    .where(
      and(
        eq(schema.timetableEntry.timetableId, input.timetableId),
        eq(schema.timetableEntry.dayId, input.dayId),
        eq(schema.timetableEntry.periodId, input.periodId)
      )
    )
    .all()
    .filter((e) => !exclude.includes(e.id))

  if (entriesAtSlot.some((e) => e.classId === input.classId)) {
    throw new Error('Lớp đã có tiết khác trong khung giờ này.')
  }
  if (input.teacherId && entriesAtSlot.some((e) => e.teacherId === input.teacherId)) {
    throw new Error('Giáo viên đã dạy lớp khác trong khung giờ này.')
  }
  if (input.roomId && entriesAtSlot.some((e) => e.roomId === input.roomId)) {
    throw new Error('Phòng học đã được lớp khác sử dụng trong khung giờ này.')
  }

  if (input.roomId) {
    const roomOff = db()
      .select()
      .from(schema.roomAvailability)
      .where(
        and(
          eq(schema.roomAvailability.roomId, input.roomId),
          eq(schema.roomAvailability.dayId, input.dayId),
          eq(schema.roomAvailability.periodId, input.periodId),
          eq(schema.roomAvailability.status, 'off')
        )
      )
      .get()
    if (roomOff) throw new Error('Phòng không thể sử dụng trong khung giờ này.')
  }

  if (input.teacherId) {
    const busy = db()
      .select()
      .from(schema.teacherAvailability)
      .where(
        and(
          eq(schema.teacherAvailability.teacherId, input.teacherId),
          eq(schema.teacherAvailability.dayId, input.dayId),
          eq(schema.teacherAvailability.periodId, input.periodId),
          eq(schema.teacherAvailability.status, 'busy')
        )
      )
      .get()
    if (busy) throw new Error('Giáo viên không thể dạy trong khung giờ này.')
  }

  const classOff = db()
    .select()
    .from(schema.classAvailability)
    .where(
      and(
        eq(schema.classAvailability.classId, input.classId),
        eq(schema.classAvailability.dayId, input.dayId),
        eq(schema.classAvailability.periodId, input.periodId),
        eq(schema.classAvailability.status, 'off')
      )
    )
    .get()
  if (classOff) throw new Error('Lớp không học trong khung giờ này.')

  const assignment = db()
    .select()
    .from(schema.teachingAssignment)
    .where(eq(schema.teachingAssignment.id, input.assignmentId))
    .get()
  if (!assignment) throw new Error('Phân công không tồn tại.')
  const placedForAssignment = db()
    .select()
    .from(schema.timetableEntry)
    .where(
      and(
        eq(schema.timetableEntry.timetableId, input.timetableId),
        eq(schema.timetableEntry.assignmentId, input.assignmentId)
      )
    )
    .all()
    .filter((e) => !exclude.includes(e.id)).length
  if (placedForAssignment >= assignment.periodsPerWeek) {
    throw new Error('Đã xếp đủ số tiết yêu cầu của phân công này.')
  }

  const classDayCount = db()
    .select()
    .from(schema.timetableEntry)
    .where(
      and(
        eq(schema.timetableEntry.timetableId, input.timetableId),
        eq(schema.timetableEntry.classId, input.classId),
        eq(schema.timetableEntry.dayId, input.dayId)
      )
    )
    .all()
    .filter((e) => !exclude.includes(e.id)).length
  if (classDayCount >= cls.maxPeriodsPerDay) {
    throw new Error('Lớp đã đạt số tiết tối đa trong ngày.')
  }

  if (input.teacherId) {
    const teacher = db().select().from(schema.teacher).where(eq(schema.teacher.id, input.teacherId)).get()
    if (teacher) {
      const teacherDayCount = db()
        .select()
        .from(schema.timetableEntry)
        .where(
          and(
            eq(schema.timetableEntry.timetableId, input.timetableId),
            eq(schema.timetableEntry.teacherId, input.teacherId),
            eq(schema.timetableEntry.dayId, input.dayId)
          )
        )
        .all()
        .filter((e) => !exclude.includes(e.id)).length
      if (teacherDayCount >= teacher.maxPeriodsPerDay) {
        throw new Error('Giáo viên đã đạt số tiết tối đa trong ngày.')
      }
    }
  }

  const subject = db().select().from(schema.subject).where(eq(schema.subject.id, input.subjectId)).get()
  if (subject) {
    const subjectDayCount = db()
      .select()
      .from(schema.timetableEntry)
      .where(
        and(
          eq(schema.timetableEntry.timetableId, input.timetableId),
          eq(schema.timetableEntry.classId, input.classId),
          eq(schema.timetableEntry.dayId, input.dayId),
          eq(schema.timetableEntry.subjectId, input.subjectId)
        )
      )
      .all()
      .filter((e) => !exclude.includes(e.id)).length
    if (subjectDayCount >= subject.maxPerDay) {
      throw new Error(`Môn ${subject.name} đã đạt số tiết tối đa trong ngày cho lớp này.`)
    }
  }
}

export function registerTimetableHandlers(): void {
  handle('timetable:list', (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    return db()
      .select()
      .from(schema.timetable)
      .where(eq(schema.timetable.semesterId, semesterId))
      .orderBy(asc(schema.timetable.id))
      .all()
  })

  handle('timetable:create', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        name: z.string().trim().min(1, 'Tên phương án không được để trống')
      })
      .parse(payload)
    const ctx = getContext(input.semesterId)
    const existingCount = db()
      .select()
      .from(schema.timetable)
      .where(eq(schema.timetable.semesterId, input.semesterId))
      .all().length
    return db()
      .insert(schema.timetable)
      .values({
        schoolId: ctx.schoolId,
        semesterId: input.semesterId,
        name: input.name,
        isActive: existingCount === 0 ? 1 : 0,
        score: 0,
        note: '',
        createdAt: Date.now()
      })
      .returning()
      .get()
  })

  handle('timetable:delete', (payload) => {
    const { id } = idSchema.parse(payload)
    db().delete(schema.timetable).where(eq(schema.timetable.id, id)).run()
    return { id }
  })

  handle('timetable:rename', (payload) => {
    const input = z
      .object({ id: z.number().int().positive(), name: z.string().trim().min(1, 'Tên phương án không được để trống') })
      .parse(payload)
    return db()
      .update(schema.timetable)
      .set({ name: input.name })
      .where(eq(schema.timetable.id, input.id))
      .returning()
      .get()
  })

  handle('timetable:activate', (payload) => {
    const { id } = idSchema.parse(payload)
    const target = db().select().from(schema.timetable).where(eq(schema.timetable.id, id)).get()
    if (!target) throw new Error('Không tìm thấy phương án.')
    db().update(schema.timetable).set({ isActive: 0 }).where(eq(schema.timetable.semesterId, target.semesterId)).run()
    db().update(schema.timetable).set({ isActive: 1 }).where(eq(schema.timetable.id, id)).run()
    return { id }
  })

  handle('timetable:entries', (payload) => {
    const { timetableId } = z.object({ timetableId: z.number().int().positive() }).parse(payload)
    return db()
      .select()
      .from(schema.timetableEntry)
      .where(eq(schema.timetableEntry.timetableId, timetableId))
      .all()
  })

  handle('timetable:place', (payload) => {
    const input = placeSchema.parse(payload)
    const assignment = db()
      .select()
      .from(schema.teachingAssignment)
      .where(eq(schema.teachingAssignment.id, input.assignmentId))
      .get()
    if (!assignment) throw new Error('Phân công không tồn tại.')
    const subject = db().select().from(schema.subject).where(eq(schema.subject.id, assignment.subjectId)).get()
    const roomId = assignment.roomId ?? subject?.roomId ?? null
    checkSlotValid({
      timetableId: input.timetableId,
      classId: assignment.classId,
      teacherId: assignment.teacherId,
      roomId,
      subjectId: assignment.subjectId,
      assignmentId: assignment.id,
      dayId: input.dayId,
      periodId: input.periodId
    })
    return db()
      .insert(schema.timetableEntry)
      .values({
        timetableId: input.timetableId,
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        teacherId: assignment.teacherId,
        roomId,
        dayId: input.dayId,
        periodId: input.periodId,
        assignmentId: assignment.id,
        locked: 0
      })
      .returning()
      .get()
  })

  handle('timetable:move', (payload) => {
    const input = moveSchema.parse(payload)
    const entry = getEntryOrThrow(input.entryId)
    if (entry.locked) throw new Error('Tiết đã bị khóa, hãy mở khóa trước khi di chuyển.')
    checkSlotValid({
      timetableId: entry.timetableId,
      classId: entry.classId,
      teacherId: entry.teacherId,
      roomId: entry.roomId,
      subjectId: entry.subjectId,
      assignmentId: entry.assignmentId as number,
      dayId: input.dayId,
      periodId: input.periodId,
      excludeEntryIds: [entry.id]
    })
    return db()
      .update(schema.timetableEntry)
      .set({ dayId: input.dayId, periodId: input.periodId })
      .where(eq(schema.timetableEntry.id, entry.id))
      .returning()
      .get()
  })

  handle('timetable:swap', (payload) => {
    const input = swapSchema.parse(payload)
    const e1 = getEntryOrThrow(input.entryId1)
    const e2 = getEntryOrThrow(input.entryId2)
    if (e1.timetableId !== e2.timetableId) throw new Error('Không thể đổi chỗ giữa hai phương án khác nhau.')
    if (e1.locked || e2.locked) throw new Error('Không thể đổi chỗ tiết đã khóa.')

    checkSlotValid({
      timetableId: e1.timetableId,
      classId: e1.classId,
      teacherId: e1.teacherId,
      roomId: e1.roomId,
      subjectId: e1.subjectId,
      assignmentId: e1.assignmentId as number,
      dayId: e2.dayId,
      periodId: e2.periodId,
      excludeEntryIds: [e1.id, e2.id]
    })
    checkSlotValid({
      timetableId: e2.timetableId,
      classId: e2.classId,
      teacherId: e2.teacherId,
      roomId: e2.roomId,
      subjectId: e2.subjectId,
      assignmentId: e2.assignmentId as number,
      dayId: e1.dayId,
      periodId: e1.periodId,
      excludeEntryIds: [e1.id, e2.id]
    })

    db()
      .update(schema.timetableEntry)
      .set({ dayId: e2.dayId, periodId: e2.periodId })
      .where(eq(schema.timetableEntry.id, e1.id))
      .run()
    db()
      .update(schema.timetableEntry)
      .set({ dayId: e1.dayId, periodId: e1.periodId })
      .where(eq(schema.timetableEntry.id, e2.id))
      .run()
    return { ok: true }
  })

  handle('timetable:remove', (payload) => {
    const { id } = idSchema.parse(payload)
    const entry = getEntryOrThrow(id)
    if (entry.locked) throw new Error('Tiết đã bị khóa, hãy mở khóa trước khi xóa.')
    db().delete(schema.timetableEntry).where(eq(schema.timetableEntry.id, id)).run()
    return { id }
  })

  handle('timetable:toggleLock', (payload) => {
    const { id } = idSchema.parse(payload)
    const entry = getEntryOrThrow(id)
    return db()
      .update(schema.timetableEntry)
      .set({ locked: entry.locked ? 0 : 1 })
      .where(eq(schema.timetableEntry.id, id))
      .returning()
      .get()
  })

  handle('timetable:progress', (payload) => {
    const { timetableId } = z.object({ timetableId: z.number().int().positive() }).parse(payload)
    const tt = db().select().from(schema.timetable).where(eq(schema.timetable.id, timetableId)).get()
    if (!tt) throw new Error('Không tìm thấy phương án.')
    const assignments = db()
      .select()
      .from(schema.teachingAssignment)
      .where(eq(schema.teachingAssignment.semesterId, tt.semesterId))
      .all()
    const entries = db()
      .select()
      .from(schema.timetableEntry)
      .where(eq(schema.timetableEntry.timetableId, timetableId))
      .all()
    const placedByAssignment = new Map<number, number>()
    for (const e of entries) {
      if (!e.assignmentId) continue
      placedByAssignment.set(e.assignmentId, (placedByAssignment.get(e.assignmentId) ?? 0) + 1)
    }
    const items = assignments.map((a) => ({
      assignmentId: a.id,
      classId: a.classId,
      subjectId: a.subjectId,
      teacherId: a.teacherId,
      required: a.periodsPerWeek,
      placed: placedByAssignment.get(a.id) ?? 0
    }))
    return {
      items,
      totalRequired: items.reduce((s, i) => s + i.required, 0),
      totalPlaced: items.reduce((s, i) => s + i.placed, 0)
    }
  })

  handle('timetable:clone', (payload) => {
    const input = z
      .object({
        id: z.number().int().positive(),
        name: z.string().trim().min(1, 'Tên phương án không được để trống')
      })
      .parse(payload)

    const source = db().select().from(schema.timetable).where(eq(schema.timetable.id, input.id)).get()
    if (!source) throw new Error('Không tìm thấy phương án nguồn.')

    const newTt = db()
      .insert(schema.timetable)
      .values({
        schoolId: source.schoolId,
        semesterId: source.semesterId,
        name: input.name,
        isActive: 0,
        score: source.score,
        note: source.note,
        createdAt: Date.now()
      })
      .returning()
      .get()

    const entries = db()
      .select()
      .from(schema.timetableEntry)
      .where(eq(schema.timetableEntry.timetableId, source.id))
      .all()

    for (const e of entries) {
      db()
        .insert(schema.timetableEntry)
        .values({
          timetableId: newTt.id,
          classId: e.classId,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          roomId: e.roomId,
          dayId: e.dayId,
          periodId: e.periodId,
          assignmentId: e.assignmentId,
          locked: e.locked
        })
        .run()
    }
    return newTt
  })

  handle('timetable:clearScope', (payload) => {
    const input = z
      .object({
        timetableId: z.number().int().positive(),
        classId: z.number().int().positive().optional()
      })
      .parse(payload)

    if (input.classId) {
      db()
        .delete(schema.timetableEntry)
        .where(
          and(
            eq(schema.timetableEntry.timetableId, input.timetableId),
            eq(schema.timetableEntry.classId, input.classId),
            eq(schema.timetableEntry.locked, 0)
          )
        )
        .run()
    } else {
      db()
        .delete(schema.timetableEntry)
        .where(
          and(
            eq(schema.timetableEntry.timetableId, input.timetableId),
            eq(schema.timetableEntry.locked, 0)
          )
        )
        .run()
    }
    return { ok: true }
  })

  handle('timetable:lockScope', (payload) => {
    const input = z
      .object({
        timetableId: z.number().int().positive(),
        classId: z.number().int().positive().optional(),
        locked: z.number().int().min(0).max(1)
      })
      .parse(payload)

    if (input.classId) {
      db()
        .update(schema.timetableEntry)
        .set({ locked: input.locked })
        .where(
          and(
            eq(schema.timetableEntry.timetableId, input.timetableId),
            eq(schema.timetableEntry.classId, input.classId)
          )
        )
        .run()
    } else {
      db()
        .update(schema.timetableEntry)
        .set({ locked: input.locked })
        .where(eq(schema.timetableEntry.timetableId, input.timetableId))
        .run()
    }
    return { ok: true }
  })
}
