import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle } from './util'
import { getContext } from './context'

export function registerTeacherAvailabilityHandlers(): void {
  handle('teacherAvailability:list', (payload) => {
    const { teacherId } = z.object({ teacherId: z.number().int().positive() }).parse(payload)
    return db()
      .select()
      .from(schema.teacherAvailability)
      .where(eq(schema.teacherAvailability.teacherId, teacherId))
      .all()
  })

  handle('teacherAvailability:set', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        teacherId: z.number().int().positive(),
        dayId: z.number().int().positive(),
        periodId: z.number().int().positive(),
        status: z.enum(['busy', 'prefer'])
      })
      .parse(payload)
    const ctx = getContext(input.semesterId)
    const existing = db()
      .select()
      .from(schema.teacherAvailability)
      .where(
        and(
          eq(schema.teacherAvailability.teacherId, input.teacherId),
          eq(schema.teacherAvailability.dayId, input.dayId),
          eq(schema.teacherAvailability.periodId, input.periodId)
        )
      )
      .get()
    if (existing) {
      return db()
        .update(schema.teacherAvailability)
        .set({ status: input.status })
        .where(eq(schema.teacherAvailability.id, existing.id))
        .returning()
        .get()
    }
    return db()
      .insert(schema.teacherAvailability)
      .values({
        schoolId: ctx.schoolId,
        semesterId: input.semesterId,
        teacherId: input.teacherId,
        dayId: input.dayId,
        periodId: input.periodId,
        status: input.status
      })
      .returning()
      .get()
  })

  handle('teacherAvailability:unset', (payload) => {
    const input = z
      .object({
        teacherId: z.number().int().positive(),
        dayId: z.number().int().positive(),
        periodId: z.number().int().positive()
      })
      .parse(payload)
    db()
      .delete(schema.teacherAvailability)
      .where(
        and(
          eq(schema.teacherAvailability.teacherId, input.teacherId),
          eq(schema.teacherAvailability.dayId, input.dayId),
          eq(schema.teacherAvailability.periodId, input.periodId)
        )
      )
      .run()
    return { ok: true }
  })

  handle('teacherAvailability:clearAll', (payload) => {
    const { teacherId } = z.object({ teacherId: z.number().int().positive() }).parse(payload)
    db().delete(schema.teacherAvailability).where(eq(schema.teacherAvailability.teacherId, teacherId)).run()
    return { teacherId }
  })
}
