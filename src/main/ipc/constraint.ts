import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle } from './util'
import { getContext } from './context'
import { CONSTRAINT_PRESETS } from '../../shared/constants'

export function registerConstraintHandlers(): void {
  handle('constraint:list', (payload) => {
    const input = z.object({ semesterId: z.number().int().positive() }).parse(payload)
    return db()
      .select()
      .from(schema.schedulingConstraint)
      .where(eq(schema.schedulingConstraint.semesterId, input.semesterId))
      .all()
  })

  handle('constraint:setMany', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        items: z.array(z.object({ key: z.string(), level: z.string() }))
      })
      .parse(payload)

    const { schoolId } = getContext(input.semesterId)
    for (const it of input.items) {
      const existing = db()
        .select()
        .from(schema.schedulingConstraint)
        .where(
          and(
            eq(schema.schedulingConstraint.semesterId, input.semesterId),
            eq(schema.schedulingConstraint.key, it.key)
          )
        )
        .get()

      if (existing) {
        db()
          .update(schema.schedulingConstraint)
          .set({ level: it.level })
          .where(eq(schema.schedulingConstraint.id, existing.id))
          .run()
      } else {
        db()
          .insert(schema.schedulingConstraint)
          .values({
            schoolId,
            semesterId: input.semesterId,
            key: it.key,
            level: it.level
          })
          .run()
      }
    }
    return { success: true }
  })

  handle('constraint:applyPreset', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        presetId: z.string()
      })
      .parse(payload)

    const preset = CONSTRAINT_PRESETS.find((p) => p.id === input.presetId)
    if (!preset) throw new Error(`Không tìm thấy bộ mẫu cấu hình "${input.presetId}".`)

    const { schoolId } = getContext(input.semesterId)
    const items = [
      { key: 'teacherGaps', level: String(preset.weights.teacherGaps) },
      { key: 'subjectSpread', level: String(preset.weights.subjectSpread) },
      { key: 'teacherPrefer', level: String(preset.weights.teacherPrefer) },
      { key: 'avoidSinglePeriod', level: String(preset.weights.avoidSinglePeriod) },
      { key: 'softDoublePairs', level: String(preset.weights.softDoublePairs) },
      { key: 'timeLimit', level: String(preset.timeLimit) },
      { key: 'mode', level: preset.mode },
      { key: 'presetId', level: preset.id }
    ]

    for (const it of items) {
      const existing = db()
        .select()
        .from(schema.schedulingConstraint)
        .where(
          and(
            eq(schema.schedulingConstraint.semesterId, input.semesterId),
            eq(schema.schedulingConstraint.key, it.key)
          )
        )
        .get()

      if (existing) {
        db()
          .update(schema.schedulingConstraint)
          .set({ level: it.level })
          .where(eq(schema.schedulingConstraint.id, existing.id))
          .run()
      } else {
        db()
          .insert(schema.schedulingConstraint)
          .values({
            schoolId,
            semesterId: input.semesterId,
            key: it.key,
            level: it.level
          })
          .run()
      }
    }
    return { success: true, preset }
  })
}
