import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle, semesterScope } from './util'

export function registerSubjectGradeHandlers(): void {
  handle('subjectGrade:list', (payload) => {
    const { subjectId } = z.object({ subjectId: z.number().int().positive() }).parse(payload)
    return db()
      .select({ gradeId: schema.subjectGrade.gradeId })
      .from(schema.subjectGrade)
      .where(eq(schema.subjectGrade.subjectId, subjectId))
      .all()
      .map((r) => r.gradeId)
  })

  handle('subjectGrade:set', (payload) => {
    const input = z
      .object({
        subjectId: z.number().int().positive(),
        gradeIds: z.array(z.number().int().positive())
      })
      .parse(payload)
    db().delete(schema.subjectGrade).where(eq(schema.subjectGrade.subjectId, input.subjectId)).run()
    for (const gradeId of input.gradeIds) {
      db().insert(schema.subjectGrade).values({ subjectId: input.subjectId, gradeId }).run()
    }
    return { subjectId: input.subjectId, gradeIds: input.gradeIds }
  })

  handle('subjectGrade:listBySemester', (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    const subjectIds = db()
      .select({ id: schema.subject.id })
      .from(schema.subject)
      .where(eq(schema.subject.semesterId, semesterId))
      .all()
      .map((s) => s.id)
    if (subjectIds.length === 0) return []
    return db()
      .select()
      .from(schema.subjectGrade)
      .where(inArray(schema.subjectGrade.subjectId, subjectIds))
      .all()
  })
}
