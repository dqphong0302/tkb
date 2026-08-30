import { useEffect, useMemo, useState } from 'react'
import type {
  Grade,
  HomeroomAssignment,
  Room,
  School,
  SchoolClass,
  Subject,
  Teacher,
  TeachingAssignment,
  TeachingDay
} from '@shared/types'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'

interface Props {
  semesterId: number
  school: School
  version: number
}

export function StatisticsPage({ semesterId, school, version }: Props) {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([])
  const [homerooms, setHomerooms] = useState<HomeroomAssignment[]>([])
  const [days, setDays] = useState<TeachingDay[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      try {
        const [t, s, c, a, h, d, g, r] = await Promise.all([
          call<Teacher[]>('teacher:list', { semesterId }),
          call<Subject[]>('subject:list', { semesterId }),
          call<SchoolClass[]>('class:list', { semesterId }),
          call<TeachingAssignment[]>('assignment:list', { semesterId }),
          call<HomeroomAssignment[]>('homeroom:list', { semesterId }),
          call<TeachingDay[]>('day:list', { semesterId }),
          call<Grade[]>('grade:list', { semesterId }),
          call<Room[]>('room:list', { semesterId })
        ])
        if (cancelled) return
        setTeachers(t)
        setSubjects(s)
        setClasses(c)
        setAssignments(a)
        setHomerooms(h)
        setDays(d)
        setGrades(g)
        setRooms(r)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [semesterId, version])

  const activeDayCount = days.filter((d) => d.isActive === 1).length

  const teacherStats = useMemo(() => {
    return teachers
      .map((t) => {
        const own = assignments.filter((a) => a.teacherId === t.id)
        const totalPeriods = own.reduce((sum, a) => sum + a.periodsPerWeek, 0)
        const classCodes = Array.from(
          new Set(own.map((a) => classes.find((c) => c.id === a.classId)?.code).filter(Boolean))
        ) as string[]
        const homeroomClasses = homerooms
          .filter((h) => h.teacherId === t.id)
          .map((h) => classes.find((c) => c.id === h.classId)?.code)
          .filter(Boolean) as string[]
        const overLimit = school.maxPeriodsPerWeek > 0 && totalPeriods > school.maxPeriodsPerWeek
        return { teacher: t, totalPeriods, classCodes, homeroomClasses, overLimit }
      })
      .sort((a, b) => b.totalPeriods - a.totalPeriods)
  }, [teachers, assignments, classes, homerooms, school.maxPeriodsPerWeek])

  const subjectStats = useMemo(() => {
    return subjects
      .map((s) => {
        const own = assignments.filter((a) => a.subjectId === s.id)
        const totalPeriods = own.reduce((sum, a) => sum + a.periodsPerWeek, 0)
        return {
          subject: s,
          totalPeriods,
          classCount: own.length,
          noTeacherCount: own.filter((a) => !a.teacherId).length
        }
      })
      .sort((a, b) => b.totalPeriods - a.totalPeriods)
  }, [subjects, assignments])

  const classStats = useMemo(() => {
    return classes
      .map((c) => {
        const own = assignments.filter((a) => a.classId === c.id)
        const totalPeriods = own.reduce((sum, a) => sum + a.periodsPerWeek, 0)
        const capacity = c.maxPeriodsPerDay * activeDayCount
        const percent = capacity > 0 ? Math.round((totalPeriods / capacity) * 100) : 0
        return {
          class: c,
          grade: grades.find((g) => g.id === c.gradeId)?.name ?? '',
          totalPeriods,
          capacity,
          percent,
          overCapacity: capacity > 0 && totalPeriods > capacity
        }
      })
      .sort((a, b) => b.totalPeriods - a.totalPeriods)
  }, [classes, assignments, grades, activeDayCount])

  const totalPeriodsAll = assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0)
  const noTeacherAssignments = assignments.filter((a) => !a.teacherId).length

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Thống kê</h2>
        <p className="text-sm text-slate-500">
          Tổng hợp số tiết theo giáo viên, môn học và lớp dựa trên dữ liệu phân công hiện tại của học kỳ.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        {[
          ['Khối', grades.length],
          ['Lớp', classes.length],
          ['Môn học', subjects.length],
          ['Giáo viên', teachers.length],
          ['Phòng học', rooms.length],
          ['Tổng số tiết/tuần', totalPeriodsAll]
        ].map(([label, value]) => (
          <div key={label as string} className="card p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {noTeacherAssignments > 0 && (
        <Alert tone="warn">{noTeacherAssignments} phân công chưa có giáo viên phụ trách.</Alert>
      )}

      <section className="card overflow-hidden">
        <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">
          Theo giáo viên {school.maxPeriodsPerWeek > 0 && `(định mức ${school.maxPeriodsPerWeek} tiết/tuần)`}
        </h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Mã GV</th>
              <th className="th">Họ tên</th>
              <th className="th">Số lớp dạy</th>
              <th className="th">Chủ nhiệm</th>
              <th className="th text-right">Tổng tiết/tuần</th>
            </tr>
          </thead>
          <tbody>
            {teacherStats.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={5}>
                  Chưa có giáo viên.
                </td>
              </tr>
            )}
            {teacherStats.map((row) => (
              <tr key={row.teacher.id} className="hover:bg-slate-50">
                <td className="td">{row.teacher.code}</td>
                <td className="td">{row.teacher.fullName}</td>
                <td className="td">{row.classCodes.join(', ') || '—'}</td>
                <td className="td">{row.homeroomClasses.join(', ') || '—'}</td>
                <td className="td text-right">
                  <span className={row.overLimit ? 'font-semibold text-red-600' : ''}>
                    {row.totalPeriods}
                  </span>
                  {row.overLimit && (
                    <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                      Vượt định mức
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">Theo môn học</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Tên môn</th>
              <th className="th">Số lớp học môn này</th>
              <th className="th text-right">Tổng tiết/tuần</th>
            </tr>
          </thead>
          <tbody>
            {subjectStats.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={3}>
                  Chưa có môn học.
                </td>
              </tr>
            )}
            {subjectStats.map((row) => (
              <tr key={row.subject.id} className="hover:bg-slate-50">
                <td className="td">{row.subject.name}</td>
                <td className="td">
                  {row.classCount}
                  {row.noTeacherCount > 0 && (
                    <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                      {row.noTeacherCount} thiếu GV
                    </span>
                  )}
                </td>
                <td className="td text-right">{row.totalPeriods}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">Theo lớp</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Mã lớp</th>
              <th className="th">Khối</th>
              <th className="th">Đã phân công / Sức chứa lý thuyết</th>
              <th className="th text-right">Tỉ lệ lấp đầy</th>
            </tr>
          </thead>
          <tbody>
            {classStats.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={4}>
                  Chưa có lớp.
                </td>
              </tr>
            )}
            {classStats.map((row) => (
              <tr key={row.class.id} className="hover:bg-slate-50">
                <td className="td">{row.class.code}</td>
                <td className="td">{row.grade}</td>
                <td className="td">
                  {row.totalPeriods} / {row.capacity || '—'}
                  {row.overCapacity && (
                    <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                      Vượt sức chứa
                    </span>
                  )}
                </td>
                <td className="td text-right">{row.capacity > 0 ? `${row.percent}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
