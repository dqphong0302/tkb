import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { handle, idSchema, semesterScope } from './util'
import { getContext } from './context'

type AnyTable = any

export interface CrudOptions {
  name: string
  table: AnyTable
  createSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
  orderColumns?: (table: AnyTable) => any[]
  usageCheck?: (id: number) => string | null
}

export function registerCrud(opts: CrudOptions): void {
  const { name, table, createSchema, updateSchema } = opts

  handle(`${name}:list`, (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    const order = opts.orderColumns ? opts.orderColumns(table) : [asc(table.id)]
    return db().select().from(table).where(eq(table.semesterId, semesterId)).orderBy(...order).all()
  })

  handle(`${name}:create`, (payload) => {
    const input = createSchema.parse(payload) as Record<string, unknown>
    const ctx = getContext(input.semesterId as number)
    const rows = db()
      .insert(table)
      .values({ ...input, schoolId: ctx.schoolId })
      .returning()
      .all() as any[]
    return rows[0]
  })

  handle(`${name}:update`, (payload) => {
    const { id } = idSchema.parse(payload)
    const patch = updateSchema.parse((payload as any).patch ?? {}) as Record<string, unknown>
    const rows = db().update(table).set(patch).where(eq(table.id, id)).returning().all() as any[]
    if (!rows.length) throw new Error('Không tìm thấy bản ghi cần sửa.')
    return rows[0]
  })

  handle(`${name}:delete`, (payload) => {
    const { id } = idSchema.parse(payload)
    const usageError = opts.usageCheck?.(id)
    if (usageError) throw new Error(usageError)
    db().delete(table).where(eq(table.id, id)).run()
    return { id }
  })
}
