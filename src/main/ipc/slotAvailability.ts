import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle } from './util'
import { getContext } from './context'

const slotSchema = z.object({ entityId: z.number().int().positive(), dayId: z.number().int().positive(), periodId: z.number().int().positive() })

function register(kind: 'class' | 'room'): void {
  const table = kind === 'class' ? schema.classAvailability : schema.roomAvailability
  const source = kind === 'class' ? schema.schoolClass : schema.room
  const key = kind === 'class' ? schema.classAvailability.classId : schema.roomAvailability.roomId
  const channel = `${kind}Availability`

  handle(`${channel}:list`, (payload) => {
    const { entityId } = z.object({ entityId: z.number().int().positive() }).parse(payload)
    return db().select().from(table).where(eq(key, entityId)).all()
  })

  handle(`${channel}:set`, (payload) => {
    const input = slotSchema.parse(payload)
    const entity = db().select().from(source).where(eq(source.id, input.entityId)).get()
    if (!entity) throw new Error(kind === 'class' ? 'Không tìm thấy lớp.' : 'Không tìm thấy phòng.')
    const context = getContext(entity.semesterId)
    const existing = db().select().from(table).where(and(eq(key, input.entityId), eq(table.dayId, input.dayId), eq(table.periodId, input.periodId))).get()
    if (existing) return existing
    return db().insert(table).values({ schoolId: context.schoolId, semesterId: entity.semesterId, [kind === 'class' ? 'classId' : 'roomId']: input.entityId, dayId: input.dayId, periodId: input.periodId, status: 'off' }).returning().get()
  })

  handle(`${channel}:unset`, (payload) => {
    const input = slotSchema.parse(payload)
    db().delete(table).where(and(eq(key, input.entityId), eq(table.dayId, input.dayId), eq(table.periodId, input.periodId))).run()
    return { ok: true }
  })

  handle(`${channel}:clearAll`, (payload) => {
    const { entityId } = z.object({ entityId: z.number().int().positive() }).parse(payload)
    db().delete(table).where(eq(key, entityId)).run()
    return { ok: true }
  })
}

export function registerSlotAvailabilityHandlers(): void {
  register('class')
  register('room')
}
