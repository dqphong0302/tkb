import { useMemo } from 'react'
import type {
  Period,
  SchoolClass,
  Subject,
  Teacher,
  TeachingAssignment,
  TeachingDay
} from '@shared/types'
import { useList } from '../../lib/useList'
import { Alert } from '../../components/Alert'
import type { StepProps } from './types'

export function PeriodsStep({ semesterId }: StepProps) {
  const classes = useList<SchoolClass>('class:list', { semesterId })
  const subjects = useList<Subject>('subject:list', { semesterId })
  const teachers = useList<Teacher>('teacher:list', { semesterId })
  const days = useList<TeachingDay>('day:list', { semesterId })
  const periods = useList<Period>('period:list', { semesterId })
  const assignments = useList<TeachingAssignment>('assignment:list', { semesterId })

  const activeDays = days.items.filter((d) => d.isActive === 1).length
  const morning = periods.items.filter((p) => p.shift === 'morning').length
  const afternoon = periods.items.filter((p) => p.shift === 'afternoon').length

  const classRows = useMemo(
    () =>
      classes.items.map((c) => {
        const rows = assignments.items.filter((a) => a.classId === c.id)
        const total = rows.reduce((sum, a) => sum + a.periodsPerWeek, 0)
        const slotsPerDay =
          c.shift === 'full' ? morning + afternoon : c.shift === 'morning' ? morning : afternoon
        const capacity = activeDays * Math.min(c.maxPeriodsPerDay, slotsPerDay)
        return { c, total, capacity, missingTeacher: rows.filter((a) => !a.teacherId).length }
      }),
    [classes.items, assignments.items, activeDays, morning, afternoon]
  )

  const teacherRows = useMemo(
    () =>
      teachers.items.map((t) => {
        const rows = assignments.items.filter((a) => a.teacherId === t.id)
        const total = rows.reduce((sum, a) => sum + a.periodsPerWeek, 0)
        const capacity = activeDays * t.maxPeriodsPerDay
        return { t, total, capacity, classCount: new Set(rows.map((r) => r.classId)).size }
      }),
    [teachers.items, assignments.items, activeDays]
  )

  const grandTotal = assignments.items.reduce((s, a) => s + a.periodsPerWeek, 0)
  const noSubjectAssigned = subjects.items.filter(
    (s) => !assignments.items.some((a) => a.subjectId === s.id && a.periodsPerWeek > 0)
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Số tiết mỗi tuần</h2>
        <p className="text-sm text-slate-500">
          Kiểm tra tổng số tiết trước khi xếp lịch. Tổng toàn trường: {grandTotal} tiết/tuần.
        </p>
      </div>

      {noSubjectAssigned.length > 0 && (
        <Alert tone="warn">
          Môn chưa được phân công ở lớp nào: {noSubjectAssigned.map((s) => s.name).join(', ')}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
            Theo lớp
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Lớp</th>
                <th className="th w-24">Tiết/tuần</th>
                <th className="th w-24">Sức chứa</th>
                <th className="th">Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {classRows.map(({ c, total, capacity, missingTeacher }) => (
                <tr key={c.id}>
                  <td className="td">{c.code}</td>
                  <td className="td">{total}</td>
                  <td className="td">{capacity}</td>
                  <td className="td text-xs text-amber-600">
                    {total > capacity ? 'Vượt sức chứa. ' : ''}
                    {total === 0 ? 'Chưa có phân công. ' : ''}
                    {missingTeacher > 0 ? `${missingTeacher} môn thiếu GV.` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold">
            Theo giáo viên
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Giáo viên</th>
                <th className="th w-24">Tiết/tuần</th>
                <th className="th w-24">Tối đa</th>
                <th className="th w-20">Số lớp</th>
              </tr>
            </thead>
            <tbody>
              {teacherRows.map(({ t, total, capacity, classCount }) => (
                <tr key={t.id} className={total > capacity ? 'bg-amber-50' : ''}>
                  <td className="td">
                    {t.code} — {t.fullName}
                  </td>
                  <td className="td">{total}</td>
                  <td className="td">{capacity}</td>
                  <td className="td">{classCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
