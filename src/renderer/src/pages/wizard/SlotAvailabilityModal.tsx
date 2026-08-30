import { useEffect, useMemo, useState } from 'react'
import type { Period, TeachingDay } from '@shared/types'
import { call } from '../../lib/api'
import { Alert } from '../../components/Alert'
import { Modal } from '../../components/Modal'

interface Row { dayId: number; periodId: number }

export function SlotAvailabilityModal({
  kind,
  entityId,
  name,
  semesterId,
  open,
  onClose
}: {
  kind: 'class' | 'room'
  entityId: number
  name: string
  semesterId: number
  open: boolean
  onClose: () => void
}) {
  const [days, setDays] = useState<TeachingDay[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [offSlots, setOffSlots] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const channel = `${kind}Availability`

  useEffect(() => {
    if (!open) return
    setError(null)
    void Promise.all([
      call<TeachingDay[]>('day:list', { semesterId }),
      call<Period[]>('period:list', { semesterId }),
      call<Row[]>(`${channel}:list`, { entityId })
    ]).then(([dayRows, periodRows, slotRows]) => {
      setDays(dayRows.filter((day) => day.isActive === 1).sort((a, b) => a.weekday - b.weekday))
      setPeriods(periodRows.sort((a, b) => (a.shift === b.shift ? a.orderNo - b.orderNo : a.shift === 'morning' ? -1 : 1)))
      setOffSlots(slotRows)
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [open, semesterId, entityId, channel])

  const slotKeys = useMemo(() => new Set(offSlots.map((slot) => `${slot.dayId}:${slot.periodId}`)), [offSlots])

  async function toggle(dayId: number, periodId: number) {
    const key = `${dayId}:${periodId}`
    try {
      if (slotKeys.has(key)) {
        await call(`${channel}:unset`, { entityId, dayId, periodId })
        setOffSlots((rows) => rows.filter((slot) => `${slot.dayId}:${slot.periodId}` !== key))
      } else {
        await call(`${channel}:set`, { entityId, dayId, periodId })
        setOffSlots((rows) => [...rows, { dayId, periodId }])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return <Modal title={`Khung giờ không sử dụng - ${name}`} open={open} onClose={onClose} footer={<button className="btn-primary" onClick={onClose}>Xong</button>}>
    <p className="mb-3 text-sm text-slate-500">Bấm vào ô để đánh dấu {kind === 'class' ? 'lớp không học' : 'phòng không sử dụng'} trong khung giờ đó.</p>
    {error && <Alert>{error}</Alert>}
    <div className="overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-center">
        <thead><tr><th className="th">Tiết</th>{days.map((day) => <th key={day.id} className="th">{day.name}</th>)}</tr></thead>
        <tbody>{periods.map((period) => <tr key={period.id}>
          <td className="td whitespace-nowrap text-left"><strong>{period.name}</strong><span className="block text-[10px] text-slate-400">{period.startTime} - {period.endTime}</span></td>
          {days.map((day) => {
            const disabled = slotKeys.has(`${day.id}:${period.id}`)
            return <td className="td" key={day.id}><button id={`${kind}-availability-${entityId}-${day.id}-${period.id}`} className={disabled ? 'rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700' : 'rounded bg-slate-100 px-2 py-1 text-xs text-slate-500'} onClick={() => void toggle(day.id, period.id)}>{disabled ? 'Nghỉ' : 'Dùng'}</button></td>
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </Modal>
}
