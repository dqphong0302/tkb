import { useEffect, useMemo, useState } from 'react'
import type { Period, Teacher, TeacherAvailability, TeachingDay } from '@shared/types'
import { call } from '../../lib/api'
import { Modal } from '../../components/Modal'
import { Alert } from '../../components/Alert'

export function TeacherAvailabilityModal({
  semesterId,
  teacher,
  days,
  periods,
  onClose
}: {
  semesterId: number
  teacher: Teacher
  days: TeachingDay[]
  periods: Period[]
  onClose: () => void
}) {
  const [rows, setRows] = useState<TeacherAvailability[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    call<TeacherAvailability[]>('teacherAvailability:list', { teacherId: teacher.id })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [teacher.id])

  const activeDays = useMemo(() => days.filter((d) => d.isActive === 1).sort((a, b) => a.weekday - b.weekday), [days])
  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => (a.shift !== b.shift ? (a.shift === 'morning' ? -1 : 1) : a.orderNo - b.orderNo)),
    [periods]
  )

  function statusAt(dayId: number, periodId: number): 'busy' | 'prefer' | null {
    return rows.find((r) => r.dayId === dayId && r.periodId === periodId)?.status ?? null
  }

  async function cycle(dayId: number, periodId: number) {
    const current = statusAt(dayId, periodId)
    try {
      if (current === null) {
        const row = await call<TeacherAvailability>('teacherAvailability:set', {
          semesterId,
          teacherId: teacher.id,
          dayId,
          periodId,
          status: 'busy'
        })
        setRows((prev) => [...prev.filter((r) => !(r.dayId === dayId && r.periodId === periodId)), row])
      } else if (current === 'busy') {
        const row = await call<TeacherAvailability>('teacherAvailability:set', {
          semesterId,
          teacherId: teacher.id,
          dayId,
          periodId,
          status: 'prefer'
        })
        setRows((prev) => [...prev.filter((r) => !(r.dayId === dayId && r.periodId === periodId)), row])
      } else {
        await call('teacherAvailability:unset', { teacherId: teacher.id, dayId, periodId })
        setRows((prev) => prev.filter((r) => !(r.dayId === dayId && r.periodId === periodId)))
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearAll() {
    if (!window.confirm('Xóa toàn bộ lịch bận/ưu tiên của giáo viên này?')) return
    await call('teacherAvailability:clearAll', { teacherId: teacher.id })
    setRows([])
  }

  return (
    <Modal
      title={`Lịch bận / ưu tiên — ${teacher.code} ${teacher.fullName}`}
      open
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={clearAll}>
            Xóa hết
          </button>
          <button className="btn-primary" onClick={onClose}>
            Xong
          </button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <p className="mb-2 text-xs text-slate-500">
        Click vào ô để chuyển: Bình thường → <span className="text-red-600">Bận (không thể dạy)</span> →{' '}
        <span className="text-emerald-600">Ưu tiên dạy</span> → Bình thường. Bộ giải và lưới xếp tay sẽ né các ô đang
        bận.
      </p>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="th w-20">Tiết</th>
              {activeDays.map((d) => (
                <th key={d.id} className="th text-center">
                  {d.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPeriods.map((p, idx) => {
              const prevShift = idx > 0 ? sortedPeriods[idx - 1].shift : null
              return (
                <tr key={p.id}>
                  {prevShift !== null && prevShift !== p.shift && (
                    <td colSpan={activeDays.length + 1} className="h-1 bg-slate-100 p-0" />
                  )}
                  <td className="td text-xs text-slate-500">{p.name}</td>
                  {activeDays.map((d) => {
                    const status = statusAt(d.id, p.id)
                    return (
                      <td key={d.id} className="td p-1 text-center">
                        <button
                          onClick={() => cycle(d.id, p.id)}
                          className={`h-8 w-full rounded ${
                            status === 'busy'
                              ? 'bg-red-100 text-red-700'
                              : status === 'prefer'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          {status === 'busy' ? 'Bận' : status === 'prefer' ? 'Ưu tiên' : ''}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
