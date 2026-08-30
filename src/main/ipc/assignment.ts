import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, raw, schema } from '../db'
import { handle, idSchema, semesterScope } from './util'
import { getContext } from './context'

const upsertSchema = z.object({
  semesterId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  teacherId: z.number().int().positive().nullable().optional(),
  periodsPerWeek: z.number().int().min(0).max(30).default(0),
  doublePeriods: z.number().int().min(0).max(15).default(0),
  doubleRequired: z.number().int().min(0).max(1).default(0),
  roomId: z.number().int().positive().nullable().optional(),
  note: z.string().default('')
})

function upsertOne(input: z.infer<typeof upsertSchema>): unknown {
  const ctx = getContext(input.semesterId)
  const existing = db()
    .select()
    .from(schema.teachingAssignment)
    .where(
      and(
        eq(schema.teachingAssignment.semesterId, input.semesterId),
        eq(schema.teachingAssignment.classId, input.classId),
        eq(schema.teachingAssignment.subjectId, input.subjectId)
      )
    )
    .get()

  if (input.periodsPerWeek === 0 && !input.teacherId && existing) {
    db().delete(schema.teachingAssignment).where(eq(schema.teachingAssignment.id, existing.id)).run()
    return null
  }

  const values = {
    schoolId: ctx.schoolId,
    semesterId: input.semesterId,
    classId: input.classId,
    subjectId: input.subjectId,
    teacherId: input.teacherId ?? null,
    periodsPerWeek: input.periodsPerWeek,
    doublePeriods: input.doublePeriods,
    doubleRequired: input.doubleRequired,
    roomId: input.roomId ?? null,
    note: input.note
  }

  if (existing) {
    return db()
      .update(schema.teachingAssignment)
      .set(values)
      .where(eq(schema.teachingAssignment.id, existing.id))
      .returning()
      .get()
  }
  return db().insert(schema.teachingAssignment).values(values).returning().get()
}

export function registerAssignmentHandlers(): void {
  handle('assignment:list', (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    return db()
      .select()
      .from(schema.teachingAssignment)
      .where(eq(schema.teachingAssignment.semesterId, semesterId))
      .orderBy(asc(schema.teachingAssignment.classId), asc(schema.teachingAssignment.subjectId))
      .all()
  })

  handle('assignment:upsert', (payload) => upsertOne(upsertSchema.parse(payload)))

  handle('assignment:upsertMany', (payload) => {
    const rows = z.object({ items: z.array(upsertSchema) }).parse(payload).items
    const tx = raw().transaction((items: z.infer<typeof upsertSchema>[]) =>
      items.map((item) => upsertOne(item))
    )
    return tx(rows)
  })

  handle('assignment:delete', (payload) => {
    const { id } = idSchema.parse(payload)
    db().delete(schema.teachingAssignment).where(eq(schema.teachingAssignment.id, id)).run()
    return { id }
  })

  handle('assignment:copyGrade', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        fromClassId: z.number().int().positive(),
        toClassIds: z.array(z.number().int().positive()).min(1),
        withTeacher: z.boolean().default(false)
      })
      .parse(payload)

    const source = db()
      .select()
      .from(schema.teachingAssignment)
      .where(
        and(
          eq(schema.teachingAssignment.semesterId, input.semesterId),
          eq(schema.teachingAssignment.classId, input.fromClassId)
        )
      )
      .all()

    let count = 0
    for (const target of input.toClassIds) {
      if (target === input.fromClassId) continue
      for (const row of source) {
        upsertOne({
          semesterId: input.semesterId,
          classId: target,
          subjectId: row.subjectId,
          teacherId: input.withTeacher ? row.teacherId : null,
          periodsPerWeek: row.periodsPerWeek,
          doublePeriods: row.doublePeriods,
          doubleRequired: row.doubleRequired,
          roomId: row.roomId,
          note: row.note
        })
        count++
      }
    }
    return { count }
  })
}
