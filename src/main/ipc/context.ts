import { eq } from 'drizzle-orm'
import { db, schema } from '../db'

export function getContext(semesterId: number): { schoolId: number; semesterId: number } {
  const row = db()
    .select({ schoolId: schema.semester.schoolId })
    .from(schema.semester)
    .where(eq(schema.semester.id, semesterId))
    .get()
  if (!row) throw new Error('Học kỳ không tồn tại.')
  return { schoolId: row.schoolId, semesterId }
}
