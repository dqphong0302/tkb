import { ipcMain } from 'electron'
import { z } from 'zod'

export interface IpcResult<T> {
  ok: boolean
  data?: T
  error?: string
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('UNIQUE constraint failed')) return 'Dữ liệu bị trùng, vui lòng kiểm tra lại mã hoặc tên.'
  if (msg.includes('FOREIGN KEY constraint failed'))
    return 'Không thể thao tác vì dữ liệu đang được sử dụng ở nơi khác.'
  return msg
}

export function handle<T>(channel: string, fn: (payload: any) => T | Promise<T>): void {
  ipcMain.handle(channel, async (_event, payload): Promise<IpcResult<T>> => {
    try {
      return { ok: true, data: await fn(payload ?? {}) }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return { ok: false, error: err.issues.map((i) => i.message).join('; ') }
      }
      return { ok: false, error: friendly(err) }
    }
  })
}

export const idSchema = z.object({ id: z.number().int().positive() })
export const semesterScope = z.object({ semesterId: z.number().int().positive() })
