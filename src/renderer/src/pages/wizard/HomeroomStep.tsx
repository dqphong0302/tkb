import { useState } from 'react'
import type { HomeroomAssignment, SchoolClass, Teacher } from '@shared/types'
import { call } from '../../lib/api'
import { useList } from '../../lib/useList'
import { Alert } from '../../components/Alert'
import type { StepProps } from './types'

export function HomeroomStep({ semesterId, onChanged }: StepProps) {
  const classes = useList<SchoolClass>('class:list', { semesterId })
  const teachers = useList<Teacher>('teacher:list', { semesterId })
  const homerooms = useList<HomeroomAssignment>('homeroom:list', { semesterId })
  const [error, setError] = useState<string | null>(null)

  const usage = new Map<number, number>()
  for (const h of homerooms.items) usage.set(h.teacherId, (usage.get(h.teacherId) ?? 0) + 1)

  async function set(classId: number, value: string) {
    try {
      if (value === '') await call('homeroom:clear', { semesterId, classId })
      else await call('homeroom:set', { semesterId, classId, teacherId: Number(value) })
      await homerooms.reload()
      onChanged()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (classes.items.length === 0) return <Alert tone="warn">Cần khai báo lớp trước.</Alert>
  if (teachers.items.length === 0) return <Alert tone="warn">Cần khai báo giáo viên trước.</Alert>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Giáo viên chủ nhiệm</h2>
        <p className="text-sm text-slate-500">Mỗi lớp có tối đa một giáo viên chủ nhiệm.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-40">Lớp</th>
              <th className="th">Giáo viên chủ nhiệm</th>
              <th className="th w-40">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {classes.items.map((c) => {
              const current = homerooms.items.find((h) => h.classId === c.id)
              const dup = current && (usage.get(current.teacherId) ?? 0) > 1
              return (
                <tr key={c.id}>
                  <td className="td font-medium">{c.code}</td>
                  <td className="td">
                    <select
                      className="input max-w-md"
                      value={current?.teacherId ?? ''}
                      onChange={(e) => set(c.id, e.target.value)}
                    >
                      <option value="">— Chưa gán —</option>
                      {teachers.items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} — {t.fullName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td text-xs text-amber-600">
                    {dup ? 'Giáo viên đang chủ nhiệm nhiều lớp' : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
