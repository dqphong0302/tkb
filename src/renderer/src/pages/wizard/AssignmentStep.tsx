import { useEffect, useMemo, useState } from 'react'
import type {
  Room,
  Grade,
  SchoolClass,
  Subject,
  SubjectGrade,
  Teacher,
  TeachingAssignment
} from '@shared/types'
import { call } from '../../lib/api'
import { useList } from '../../lib/useList'
import { Alert } from '../../components/Alert'
import { Modal } from '../../components/Modal'
import type { StepProps } from './types'

interface Draft {
  subjectId: number
  teacherId: number | null
  periodsPerWeek: number
  doublePeriods: number
  doubleRequired: number
  roomId: number | null
}

export function AssignmentPage({ semesterId, onChanged }: StepProps) {
  const classes = useList<SchoolClass>('class:list', { semesterId })
  const grades = useList<Grade>('grade:list', { semesterId })
  const subjects = useList<Subject>('subject:list', { semesterId })
  const teachers = useList<Teacher>('teacher:list', { semesterId })
  const rooms = useList<Room>('room:list', { semesterId })
  const assignments = useList<TeachingAssignment>('assignment:list', { semesterId })
  const subjectGrades = useList<SubjectGrade>('subjectGrade:listBySemester', { semesterId })

  const [classId, setClassId] = useState<number | null>(null)
  const [gradeId, setGradeId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyTargets, setCopyTargets] = useState<number[]>([])

  useEffect(() => {
    if (grades.items.length === 0) return

    const current = classes.items.find((c) => c.id === classId)
    const nextGradeId = current?.gradeId ?? gradeId ?? grades.items[0].id
    const firstClass = classes.items.find((c) => c.gradeId === nextGradeId) ?? null

    if (gradeId !== nextGradeId) setGradeId(nextGradeId)
    if (!current || current.gradeId !== nextGradeId) setClassId(firstClass?.id ?? null)
  }, [classes.items, grades.items, classId, gradeId])

  const gradeClasses = classes.items.filter((c) => c.gradeId === gradeId)

  const gradeIdOfClass = classes.items.find((c) => c.id === classId)?.gradeId ?? null

  const applicableSubjects = useMemo(() => {
    if (gradeIdOfClass === null) return subjects.items
    return subjects.items.filter((s) => {
      const allowed = subjectGrades.items.filter((sg) => sg.subjectId === s.id).map((sg) => sg.gradeId)
      return allowed.length === 0 || allowed.includes(gradeIdOfClass)
    })
  }, [subjects.items, subjectGrades.items, gradeIdOfClass])

  useEffect(() => {
    if (classId === null) return
    const rows = assignments.items.filter((a) => a.classId === classId)
    setDraft(
      applicableSubjects.map((s) => {
        const found = rows.find((a) => a.subjectId === s.id)
        return {
          subjectId: s.id,
          teacherId: found?.teacherId ?? null,
          periodsPerWeek: found?.periodsPerWeek ?? 0,
          doublePeriods: found?.doublePeriods ?? 0,
          doubleRequired: found?.doubleRequired ?? 0,
          roomId: found?.roomId ?? null
        }
      })
    )
    setSaved(false)
  }, [classId, applicableSubjects, assignments.items])

  const teacherLoad = useMemo(() => {
    const map = new Map<number, number>()
    for (const a of assignments.items) {
      if (!a.teacherId) continue
      map.set(a.teacherId, (map.get(a.teacherId) ?? 0) + a.periodsPerWeek)
    }
    return map
  }, [assignments.items])

  const total = draft.reduce((sum, d) => sum + d.periodsPerWeek, 0)

  function patch(subjectId: number, values: Partial<Draft>) {
    setDraft((prev) => prev.map((d) => (d.subjectId === subjectId ? { ...d, ...values } : d)))
    setSaved(false)
  }

  async function save() {
    if (classId === null) return
    try {
      await call('assignment:upsertMany', {
        items: draft.map((d) => ({ ...d, semesterId, classId }))
      })
      await assignments.reload()
      onChanged()
      setError(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function copy(withTeacher: boolean) {
    if (classId === null || copyTargets.length === 0) return
    try {
      await call('assignment:copyGrade', {
        semesterId,
        fromClassId: classId,
        toClassIds: copyTargets,
        withTeacher
      })
      await assignments.reload()
      onChanged()
      setCopyOpen(false)
      setCopyTargets([])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (classes.items.length === 0) return <Alert tone="warn">Cần khai báo lớp trước.</Alert>
  if (subjects.items.length === 0) return <Alert tone="warn">Cần khai báo môn học trước.</Alert>

  const currentClass = classes.items.find((c) => c.id === classId)
  const currentGrade = grades.items.find((g) => g.id === gradeId)
  const sameGrade = classes.items.filter(
    (c) => c.gradeId === currentClass?.gradeId && c.id !== classId
  )

  function selectGrade(nextGradeId: number) {
    setGradeId(nextGradeId)
    setClassId(classes.items.find((c) => c.gradeId === nextGradeId)?.id ?? null)
  }

  return (
    <div className="assignment-workspace space-y-4">
      <div className="section-heading assignment-heading">
        <div>
          <span className="section-kicker">Phân công giảng dạy</span>
          <h2>Phân công theo lớp</h2>
          <p>Chọn khối rồi đến lớp để gán giáo viên và số tiết cho từng môn.</p>
        </div>
        <div className="assignment-actions">
          <button
            id="copy-assignment"
            className="btn-ghost"
            disabled={sameGrade.length === 0}
            onClick={() => setCopyOpen(true)}
          >
            Sao chép sang lớp cùng khối
          </button>
          <button id="save-assignment" className="btn-primary" onClick={save}>
            Lưu phân công
          </button>
        </div>
      </div>

      <section className="assignment-tabs card" aria-label="Chọn lớp để phân công giảng dạy">
        <div className="assignment-tier">
          <div className="assignment-tier-label"><span>1</span><div><strong>Khối</strong><small>Chọn khối học</small></div></div>
          <div className="assignment-tab-list" role="tablist" aria-label="Danh sách khối">
            {grades.items.map((g) => (
              <button
                id={`assignment-grade-${g.id}`}
                key={g.id}
                role="tab"
                aria-selected={gradeId === g.id}
                className={gradeId === g.id ? 'active' : ''}
                onClick={() => selectGrade(g.id)}
              >
                {g.name}
                <span>{classes.items.filter((c) => c.gradeId === g.id).length} lớp</span>
              </button>
            ))}
          </div>
        </div>
        <div className="assignment-tier assignment-tier-second">
          <div className="assignment-tier-label"><span>2</span><div><strong>Lớp</strong><small>{currentGrade?.name ?? 'Chọn khối trước'}</small></div></div>
          <div className="assignment-tab-list" role="tablist" aria-label="Danh sách lớp">
            {gradeClasses.map((c) => (
              <button
                id={`assignment-class-${c.id}`}
                key={c.id}
                role="tab"
                aria-selected={classId === c.id}
                className={classId === c.id ? 'active' : ''}
                onClick={() => setClassId(c.id)}
              >
                <strong>{c.code}</strong><small>{c.name}</small>
              </button>
            ))}
            {gradeClasses.length === 0 && <span className="text-xs text-slate-400">Khối này chưa có lớp.</span>}
          </div>
        </div>
      </section>

      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="info">Đã lưu phân công của lớp {currentClass?.code}.</Alert>}
      {applicableSubjects.length === 0 && (
        <Alert tone="warn">Chưa có môn nào áp dụng cho khối của lớp này. Vào bước Môn học để gán khối áp dụng.</Alert>
      )}

      <div className="assignment-table card overflow-hidden">
        <div className="assignment-table-title">
          <div>
            <span>{currentGrade?.name ?? 'Khối học'}</span>
            <h3>{currentClass ? `Lớp ${currentClass.code}` : 'Chưa chọn lớp'}</h3>
          </div>
          <p>{applicableSubjects.length} môn học</p>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Tên môn</th>
              <th className="th w-28">Tiết/tuần</th>
              <th className="th w-64">Giáo viên</th>
              <th className="th w-28">Số tiết đôi</th>
              <th className="th w-28">Đôi bắt buộc</th>
              <th className="th w-52">Phòng</th>
            </tr>
          </thead>
          <tbody>
            {applicableSubjects.map((s) => {
              const d = draft.find((x) => x.subjectId === s.id)
              if (!d) return null
              return (
                <tr key={s.id} className={d.periodsPerWeek > 0 ? '' : 'text-slate-400'}>
                  <td className="td">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded"
                        style={{ background: s.color }}
                      />
                      {s.name}
                    </span>
                  </td>
                  <td className="td">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={30}
                      value={d.periodsPerWeek}
                      onChange={(e) =>
                        patch(s.id, { periodsPerWeek: Number(e.target.value || 0) })
                      }
                    />
                  </td>
                  <td className="td">
                    <select
                      className="input"
                      value={d.teacherId ?? ''}
                      onChange={(e) =>
                        patch(s.id, { teacherId: e.target.value ? Number(e.target.value) : null })
                      }
                    >
                      <option value="">— Chưa gán —</option>
                      {teachers.items.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.code} — {t.fullName} ({teacherLoad.get(t.id) ?? 0} tiết)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={15}
                      disabled={s.allowDouble === 0}
                      value={d.doublePeriods}
                      onChange={(e) => patch(s.id, { doublePeriods: Number(e.target.value || 0) })}
                    />
                  </td>
                  <td className="td text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={s.allowDouble === 0}
                      checked={d.doubleRequired === 1}
                      onChange={(e) => patch(s.id, { doubleRequired: e.target.checked ? 1 : 0 })}
                    />
                  </td>
                  <td className="td">
                    <select
                      className="input"
                      value={d.roomId ?? ''}
                      onChange={(e) =>
                        patch(s.id, { roomId: e.target.value ? Number(e.target.value) : null })
                      }
                    >
                      <option value="">— Không cố định —</option>
                      {rooms.items.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} — {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="td font-semibold">Tổng</td>
              <td className="td font-semibold">{total}</td>
              <td className="td" colSpan={4}>
                {currentClass && total > currentClass.maxPeriodsPerDay * 6 && (
                  <span className="text-amber-600">
                    Tổng số tiết vượt sức chứa lý thuyết của lớp trong tuần.
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>

      <Modal
        title="Sao chép phân công sang lớp cùng khối"
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCopyOpen(false)}>
              Hủy
            </button>
            <button className="btn-ghost" onClick={() => copy(false)}>
              Chỉ số tiết
            </button>
            <button className="btn-primary" onClick={() => copy(true)}>
              Kèm giáo viên
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-500">
          Phân công của lớp {currentClass?.code} sẽ ghi đè lên các lớp được chọn.
        </p>
        <div className="space-y-1.5">
          {sameGrade.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={copyTargets.includes(c.id)}
                onChange={(e) =>
                  setCopyTargets((prev) =>
                    e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                  )
                }
              />
              {c.code} — {c.name}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  )
}
