import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle, semesterScope } from './util'
import { getContext } from './context'

export function registerHomeroomHandlers(): void {
  handle('homeroom:list', (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    return db()
      .select()
      .from(schema.homeroomAssignment)
      .where(eq(schema.homeroomAssignment.semesterId, semesterId))
      .all()
  })

  handle('homeroom:set', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        classId: z.number().int().positive(),
        teacherId: z.number().int().positive()
      })
      .parse(payload)
    const ctx = getContext(input.semesterId)
    const existing = db()
      .select()
      .from(schema.homeroomAssignment)
      .where(
        and(
          eq(schema.homeroomAssignment.semesterId, input.semesterId),
          eq(schema.homeroomAssignment.classId, input.classId)
        )
      )
      .get()
    if (existing) {
      return db()
        .update(schema.homeroomAssignment)
        .set({ teacherId: input.teacherId })
        .where(eq(schema.homeroomAssignment.id, existing.id))
        .returning()
        .get()
    }
    return db()
      .insert(schema.homeroomAssignment)
      .values({ ...input, schoolId: ctx.schoolId })
      .returning()
      .get()
  })

  handle('homeroom:clear', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        classId: z.number().int().positive()
      })
      .parse(payload)
    db()
      .delete(schema.homeroomAssignment)
      .where(
        and(
          eq(schema.homeroomAssignment.semesterId, input.semesterId),
          eq(schema.homeroomAssignment.classId, input.classId)
        )
      )
      .run()
    return { classId: input.classId }
  })
}
