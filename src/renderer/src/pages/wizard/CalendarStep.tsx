import { useState } from 'react'
import type { Period, PeriodShift, TeachingDay } from '@shared/types'
import { PERIOD_SHIFT_LABEL } from '@shared/constants'
import { call } from '../../lib/api'
import { useList } from '../../lib/useList'
import { Alert } from '../../components/Alert'
import { ConfirmButton } from '../../components/Modal'
import type { StepProps } from './types'

export function CalendarStep({ semesterId, onChanged }: StepProps) {
  const days = useList<TeachingDay>('day:list', { semesterId })
  const periods = useList<Period>('period:list', { semesterId })
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn()
      await Promise.all([days.reload(), periods.reload()])
      onChanged()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function renderShift(shift: PeriodShift) {
    const rows = periods.items.filter((p) => p.shift === shift)
    return (
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm font-semibold">Ca {PERIOD_SHIFT_LABEL[shift].toLowerCase()}</span>
          <button
            className="btn-ghost"
            onClick={() =>
              run(() =>
                call('period:create', {
                  semesterId,
                  shift,
                  orderNo: rows.length + 1,
                  name: `Tiết ${rows.length + 1}`,
                  startTime: '',
                  endTime: ''
                })
              )
            }
          >
            + Thêm tiết
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th w-16">TT</th>
              <th className="th">Tên tiết</th>
              <th className="th w-32">Bắt đầu</th>
              <th className="th w-32">Kết thúc</th>
              <th className="th w-24 text-right">Xóa</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={5}>
                  Chưa có tiết nào.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="td">{p.orderNo}</td>
                <td className="td">
                  <input
                    className="input"
                    defaultValue={p.name}
                    onBlur={(e) =>
                      e.target.value !== p.name &&
                      run(() => call('period:update', { id: p.id, patch: { name: e.target.value } }))
                    }
                  />
                </td>
                <td className="td">
                  <input
                    className="input"
                    type="time"
                    defaultValue={p.startTime}
                    onBlur={(e) =>
                      e.target.value !== p.startTime &&
                      run(() =>
                        call('period:update', { id: p.id, patch: { startTime: e.target.value } })
                      )
                    }
                  />
                </td>
                <td className="td">
                  <input
                    className="input"
                    type="time"
                    defaultValue={p.endTime}
                    onBlur={(e) =>
                      e.target.value !== p.endTime &&
                      run(() =>
                        call('period:update', { id: p.id, patch: { endTime: e.target.value } })
                      )
                    }
                  />
                </td>
                <td className="td text-right">
                  <ConfirmButton onConfirm={() => run(() => call('period:delete', { id: p.id }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const morningCount = periods.items.filter((p) => p.shift === 'morning').length
  const afternoonCount = periods.items.filter((p) => p.shift === 'afternoon').length

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Ngày học và tiết học</h2>
          <p className="text-sm text-slate-500">
            Khai báo các ngày học trong tuần và cấu hình số tiết riêng cho ca sáng, ca chiều.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-600">Áp dụng mẫu nhanh:</span>
          <button
            type="button"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
            onClick={() =>
              run(() => call('period:applyTemplate', { semesterId, template: 'primary' }))
            }
            title="4 tiết sáng (07:30 - 10:35) và 3 tiết chiều (14:00 - 16:10), tổng 7 tiết/ngày"
          >
            🏫 Tiểu học (4 sáng, 3 chiều)
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
            onClick={() =>
              run(() => call('period:applyTemplate', { semesterId, template: 'secondary' }))
            }
            title="5 tiết sáng (07:00 - 11:15) và 5 tiết chiều (13:30 - 17:45), tổng 10 tiết/ngày"
          >
            🏫 THCS / THPT (5 sáng, 5 chiều)
          </button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Ngày học trong tuần</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
            {days.items.filter((d) => d.isActive === 1).length} ngày học được chọn
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {days.items.map((d) => (
            <label
              key={d.id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${
                d.isActive ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-xs' : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                checked={d.isActive === 1}
                onChange={(e) =>
                  run(() =>
                    call('day:update', { id: d.id, patch: { isActive: e.target.checked ? 1 : 0 } })
                  )
                }
              />
              {d.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-blue-50/60 px-4 py-2.5 text-xs text-blue-900 border border-blue-100">
        <span>
          <strong>Cấu trúc tiết học hiện tại:</strong> Ca sáng có <strong>{morningCount} tiết</strong> • Ca chiều có <strong>{afternoonCount} tiết</strong> • Tổng cộng tối đa <strong>{morningCount + afternoonCount} tiết/ngày</strong>.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {renderShift('morning')}
        {renderShift('afternoon')}
      </div>
    </div>
  )
}
