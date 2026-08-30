import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Grade,
  Period,
  SchoolClass,
  Subject,
  Teacher,
  TeachingDay,
  Timetable,
  SolverJob,
  SolverEntry,
  SolverMissing,
  SchedulingConstraint
} from '@shared/types'
import { LEVEL_LABEL, CONSTRAINT_PRESETS } from '@shared/constants'
import { call, onEvent } from '../lib/api'
import { Alert } from '../components/Alert'

export type AutoSolveScope = 'school' | 'grade' | 'classes'
type Level = 0 | 1 | 2 | 3

export interface AutoSolveRequest {
  timetableId: number | null
  scopeType: AutoSolveScope
  gradeIds?: number[]
  classIds?: number[]
}

interface SolverEvent {
  jobId: number
  type: 'progress' | 'solution' | 'done' | 'error' | 'cancelled'
  elapsedSeconds?: number
  status?: string
  phase?: string
  score?: number
  initialScore?: number | null
  lnsUsed?: boolean
  lnsImproved?: boolean
  entries?: SolverEntry[]
  missing?: SolverMissing[]
  message?: string
}

export function AutoSolvePage({
  semesterId,
  embedded = false,
  initialRequest,
  onApplied
}: {
  semesterId: number
  embedded?: boolean
  initialRequest?: AutoSolveRequest | null
  onApplied?: (timetable: Timetable) => void | Promise<void>
}) {
  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [days, setDays] = useState<TeachingDay[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [timetables, setTimetables] = useState<Timetable[]>([])
  const [jobs, setJobs] = useState<SolverJob[]>([])

  const [timetableId, setTimetableId] = useState<number | null>(initialRequest?.timetableId ?? null)
  const [scopeType, setScopeType] = useState<AutoSolveScope>(initialRequest?.scopeType ?? 'school')
  const [gradeIds, setGradeIds] = useState<number[]>(initialRequest?.gradeIds ?? [])
  const [classIds, setClassIds] = useState<number[]>(initialRequest?.classIds ?? [])
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [timeLimit, setTimeLimit] = useState(120)
  const [weights, setWeights] = useState<{
    teacherGaps: Level
    subjectSpread: Level
    teacherPrefer: Level
    avoidSinglePeriod: Level
    softDoublePairs: Level
  }>({
    teacherGaps: 2,
    subjectSpread: 2,
    teacherPrefer: 1,
    avoidSinglePeriod: 2,
    softDoublePairs: 1
  })

  const [preflightIssues, setPreflightIssues] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [jobStatus, setJobStatus] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [solvePhase, setSolvePhase] = useState<string | null>(null)
  const [initialScore, setInitialScore] = useState<number | null>(null)
  const [lnsUsed, setLnsUsed] = useState(false)
  const [lnsImproved, setLnsImproved] = useState(false)
  const [doneEntries, setDoneEntries] = useState<SolverEntry[] | null>(null)
  const [doneStatus, setDoneStatus] = useState<string | null>(null)
  const [missing, setMissing] = useState<SolverMissing[]>([])
  const [applyName, setApplyName] = useState('')
  const [previewId, setPreviewId] = useState<number | null>(null)

  const running = jobStatus === 'running'
  const jobIdRef = useRef<number | null>(null)
  jobIdRef.current = jobId

  const loadStatics = useCallback(async () => {
    const [g, c, t, s, d, p, tt, constraints] = await Promise.all([
      call<Grade[]>('grade:list', { semesterId }),
      call<SchoolClass[]>('class:list', { semesterId }),
      call<Teacher[]>('teacher:list', { semesterId }),
      call<Subject[]>('subject:list', { semesterId }),
      call<TeachingDay[]>('day:list', { semesterId }),
      call<Period[]>('period:list', { semesterId }),
      call<Timetable[]>('timetable:list', { semesterId }),
      call<SchedulingConstraint[]>('constraint:list', { semesterId }).catch(() => [])
    ])
    setGrades(g)
    setClasses(c)
    setTeachers(t)
    setSubjects(s)
    setDays(d)
    setPeriods(p)
    setTimetables(tt)
    if (tt.length > 0) setTimetableId((cur) => cur ?? initialRequest?.timetableId ?? (tt.find((x) => x.isActive === 1) ?? tt[0]).id)

    if (constraints && constraints.length > 0) {
      const cmap = new Map(constraints.map((item) => [item.key, item.level]))
      setWeights((w) => ({
        teacherGaps: cmap.has('teacherGaps') ? (Number(cmap.get('teacherGaps')) as Level) : w.teacherGaps,
        subjectSpread: cmap.has('subjectSpread') ? (Number(cmap.get('subjectSpread')) as Level) : w.subjectSpread,
        teacherPrefer: cmap.has('teacherPrefer') ? (Number(cmap.get('teacherPrefer')) as Level) : w.teacherPrefer,
        avoidSinglePeriod: cmap.has('avoidSinglePeriod') ? (Number(cmap.get('avoidSinglePeriod')) as Level) : w.avoidSinglePeriod,
        softDoublePairs: cmap.has('softDoublePairs') ? (Number(cmap.get('softDoublePairs')) as Level) : w.softDoublePairs
      }))
      if (cmap.has('timeLimit')) setTimeLimit(Number(cmap.get('timeLimit')))
      if (cmap.has('mode') && (cmap.get('mode') === 'full' || cmap.get('mode') === 'partial')) {
        setMode(cmap.get('mode') as 'full' | 'partial')
      }
    }
  }, [semesterId, initialRequest?.timetableId])

  const loadJobs = useCallback(async () => {
    setJobs(await call<SolverJob[]>('solver:jobs', { semesterId }))
  }, [semesterId])

  useEffect(() => {
    void loadStatics()
    void loadJobs()
  }, [loadStatics, loadJobs])

  useEffect(() => {
    const off = onEvent<SolverEvent>('solver:event', (evt) => {
      if (evt.jobId !== jobIdRef.current) return
      if (evt.type === 'progress') {
        setElapsed(evt.elapsedSeconds ?? 0)
        setSolvePhase(evt.status ?? null)
        if (evt.initialScore !== undefined) setInitialScore(evt.initialScore)
      } else if (evt.type === 'solution') {
        setElapsed(evt.elapsedSeconds ?? 0)
        setBestScore(evt.score ?? null)
        setDoneEntries(evt.entries ?? null)
        if (evt.phase) setSolvePhase(evt.phase === 'lns' ? 'optimizing_lns' : 'finding_feasible')
      } else if (evt.type === 'done') {
        setElapsed(evt.elapsedSeconds ?? 0)
        setBestScore(evt.score ?? null)
        setDoneEntries(evt.entries ?? null)
        setMissing(evt.missing ?? [])
        setDoneStatus(evt.status ?? null)
        setInitialScore(evt.initialScore ?? null)
        setLnsUsed(evt.lnsUsed ?? false)
        setLnsImproved(evt.lnsImproved ?? false)
        setSolvePhase(null)
        setJobStatus('done')
        void loadJobs()
      } else if (evt.type === 'error') {
        setError(evt.message ?? 'Bộ giải gặp lỗi.')
        setJobStatus('error')
        void loadJobs()
      } else if (evt.type === 'cancelled') {
        setJobStatus('cancelled')
        void loadJobs()
      }
    })
    return off
  }, [loadJobs])

  const activeDays = useMemo(() => days.filter((d) => d.isActive === 1).sort((a, b) => a.weekday - b.weekday), [days])
  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => (a.shift !== b.shift ? (a.shift === 'morning' ? -1 : 1) : a.orderNo - b.orderNo)),
    [periods]
  )

  function subjectOf(id: number) {
    return subjects.find((s) => s.id === id)
  }
  function classOf(id: number) {
    return classes.find((c) => c.id === id)
  }
  function teacherOf(id: number | null) {
    return id ? teachers.find((t) => t.id === id) : undefined
  }

  const previewEntries = useMemo(() => {
    if (!doneEntries || previewId === null) return []
    return doneEntries.filter((e) => e.classId === previewId)
  }, [doneEntries, previewId])

  async function runPreflight() {
    setError(null)
    try {
      const scope = buildScope()
      const res = await call<{ ok: boolean; issues: string[] }>('solver:preflight', { semesterId, scope })
      setPreflightIssues(res.issues)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function buildScope() {
    if (scopeType === 'grade') return { type: 'grade', gradeIds }
    if (scopeType === 'classes') return { type: 'classes', classIds }
    return { type: 'school' }
  }

  async function start() {
    if (!timetableId) return
    setError(null)
    setDoneEntries(null)
    setDoneStatus(null)
    setMissing([])
    setBestScore(null)
    setSolvePhase('finding_feasible')
    setInitialScore(null)
    setLnsUsed(false)
    setLnsImproved(false)
    setElapsed(0)
    try {
      const res = await call<{ jobId: number }>('solver:start', {
        semesterId,
        timetableId,
        scope: buildScope(),
        mode,
        timeLimitSeconds: timeLimit,
        weights
      })
      setJobId(res.jobId)
      setJobStatus('running')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function cancel() {
    if (!jobId) return
    await call('solver:cancel', { jobId })
  }

  async function apply() {
    if (!jobId || !applyName.trim()) return
    try {
      await call('timetable:list', { semesterId })
      const appliedTimetable = await call<Timetable>('solver:apply', { jobId, name: applyName.trim() })
      setApplyName('')
      setDoneEntries(null)
      setDoneStatus(null)
      setJobId(null)
      setJobStatus(null)
      await loadStatics()
      await loadJobs()
      await onApplied?.(appliedTimetable)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function discard() {
    if (jobId) void call('solver:discard', { jobId })
    setJobId(null)
    setJobStatus(null)
    setDoneEntries(null)
    setDoneStatus(null)
    setMissing([])
    setBestScore(null)
    setSolvePhase(null)
    setInitialScore(null)
    setLnsUsed(false)
    setLnsImproved(false)
  }

  const scopeClasses =
    scopeType === 'grade' ? classes.filter((c) => gradeIds.includes(c.gradeId)) : scopeType === 'classes' ? classes.filter((c) => classIds.includes(c.id)) : classes

  return (
    <div className="space-y-4">
      {!embedded && <div>
        <h2 className="text-base font-semibold">Xếp thời khóa biểu tự động</h2>
        <p className="text-sm text-slate-500">
          Bộ giải chạy trên máy (Google OR-Tools CP-SAT), không cần Internet. Kết quả chỉ được ghi vào dữ liệu khi bạn
          bấm Áp dụng.
        </p>
      </div>}

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold">1. Phạm vi và phương án gốc</h3>
          <div>
            <label className="label">Phương án gốc (giữ nguyên tiết đã khóa)</label>
            <select className="input" value={timetableId ?? ''} onChange={(e) => setTimetableId(Number(e.target.value))}>
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.isActive ? '(đang dùng)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 text-sm">
            {(
              [
                ['school', 'Toàn trường'],
                ['grade', 'Theo khối'],
                ['classes', 'Chọn lớp']
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="flex items-center gap-1.5">
                <input type="radio" checked={scopeType === v} onChange={() => setScopeType(v)} />
                {label}
              </label>
            ))}
          </div>
          {scopeType === 'grade' && (
            <div className="flex flex-wrap gap-2">
              {grades.map((g) => (
                <label key={g.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={gradeIds.includes(g.id)}
                    onChange={(e) =>
                      setGradeIds((prev) => (e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id)))
                    }
                  />
                  {g.name}
                </label>
              ))}
            </div>
          )}
          {scopeType === 'classes' && (
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {classes.map((c) => (
                <label key={c.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={classIds.includes(c.id)}
                    onChange={(e) =>
                      setClassIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                    }
                  />
                  {c.code}
                </label>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {scopeClasses.length} lớp trong phạm vi. Các lớp ngoài phạm vi và mọi tiết đã khóa được giữ nguyên làm dữ
            liệu cố định.
          </p>
          <button className="btn-ghost" onClick={runPreflight}>
            Kiểm tra dữ liệu trước khi xếp
          </button>
          {preflightIssues && preflightIssues.length === 0 && <Alert tone="info">Dữ liệu hợp lệ, có thể xếp tự động.</Alert>}
          {preflightIssues && preflightIssues.length > 0 && (
            <div className="space-y-1">
              {preflightIssues.map((issue, i) => (
                <Alert key={i} tone="warn">
                  {issue}
                </Alert>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold">2. Chế độ và tiêu chí tối ưu</h3>
          <p className="text-xs text-slate-500">
            CP-SAT tìm lịch hợp lệ trước; sau đó LNS tiếp tục giảm tiết trống và cải thiện các tiêu chí mềm. Với dữ liệu lớn,
            LNS được dùng toàn bộ thời gian còn lại.
          </p>
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} />
              Đầy đủ (bắt buộc xếp hết)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={mode === 'partial'} onChange={() => setMode('partial')} />
              Một phần (cho phép thiếu tiết)
            </label>
          </div>
          <div>
            <label className="label">Thời gian chạy tối đa (giây)</label>
            <input
              className="input w-32"
              type="number"
              min={10}
              max={600}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-slate-700">Mẫu cấu hình nhanh:</span>
            <div className="flex flex-wrap gap-1.5">
              {CONSTRAINT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => {
                    setWeights({ ...p.weights })
                    setTimeLimit(p.timeLimit)
                    setMode(p.mode)
                  }}
                  title={p.description}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          {(
            [
              ['teacherGaps', 'Giảm tiết trống của giáo viên'],
              ['subjectSpread', 'Phân bố môn đều trong tuần'],
              ['teacherPrefer', 'Ưu tiên giờ giáo viên mong muốn'],
              ['avoidSinglePeriod', 'Hạn chế GV dạy 1 tiết / buổi'],
              ['softDoublePairs', 'Ưu tiên ghép tiết đôi mềm']
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <label className="label mb-0">{label}</label>
              <select
                className="input w-36"
                value={weights[key]}
                onChange={(e) => setWeights((w) => ({ ...w, [key]: Number(e.target.value) as Level }))}
              >
                {[0, 1, 2, 3].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {LEVEL_LABEL[(['off', 'low', 'medium', 'high'] as const)[lvl]]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </section>
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">3. Chạy bộ giải</h3>
          <div className="flex gap-2">
            {!running ? (
              <button className="btn-primary" onClick={start} disabled={!timetableId}>
                Xếp tự động
              </button>
            ) : (
              <button className="btn-danger" onClick={cancel}>
                Hủy
              </button>
            )}
          </div>
        </div>

        {jobStatus && (
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>
              Trạng thái:{' '}
              <b>
                {jobStatus === 'running'
                  ? solvePhase === 'optimizing_lns'
                    ? 'Đang tối ưu bằng LNS…'
                    : 'Đang tìm lịch hợp lệ bằng CP-SAT…'
                  : jobStatus === 'done'
                    ? 'Đã xong'
                    : jobStatus === 'cancelled'
                      ? 'Đã hủy'
                      : 'Lỗi'}
              </b>
            </span>
            <span>Thời gian chạy: {elapsed.toFixed(1)}s</span>
            {bestScore !== null && <span>Điểm phương án tốt nhất tạm thời: {bestScore}</span>}
          </div>
        )}

        {doneStatus && (
          <Alert tone={doneStatus.startsWith('infeasible') && missing.length === 0 ? 'error' : 'info'}>
            {doneStatus === 'optimal' && 'Tìm thấy phương án tối ưu trong thời gian cho phép.'}
            {doneStatus === 'feasible' && 'Tìm thấy phương án hợp lệ (chưa chắc tối ưu, hết thời gian cho phép).'}
            {doneStatus === 'infeasible_full_diagnosed' &&
              'Không tìm được phương án xếp đủ 100%. Đã tự động dò ở chế độ một phần để chỉ ra các phân công gây vướng — xem danh sách bên dưới.'}
            {doneStatus === 'infeasible' && 'Không tìm thấy phương án.'}
            {lnsUsed && doneStatus !== 'infeasible' && (
              <span>
                {' '}
                {lnsImproved && initialScore !== null
                  ? `LNS đã cải thiện điểm mềm từ ${initialScore} xuống ${bestScore}.`
                  : 'LNS đã giữ nguyên hoặc cải thiện phương án CP-SAT ban đầu.'}
              </span>
            )}
          </Alert>
        )}

        {missing.length > 0 && (
          <div>
            <h4 className="mb-1 text-sm font-semibold">Phân công không xếp đủ (nhóm ràng buộc nghi vấn)</h4>
            <div className="space-y-1">
              {missing.map((m, i) => (
                <Alert key={i} tone="warn">
                  Lớp {classOf(m.classId)?.code} — môn {subjectOf(m.subjectId)?.name}: còn thiếu {m.missingCount} tiết.
                </Alert>
              ))}
            </div>
          </div>
        )}

        {doneEntries && doneEntries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Xem trước ({doneEntries.length} tiết)</h4>
              <select
                className="input w-56"
                value={previewId ?? ''}
                onChange={(e) => setPreviewId(Number(e.target.value))}
              >
                <option value="">— Chọn lớp để xem —</option>
                {scopeClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            {previewId !== null && (
              <div className="card overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="th w-24">Tiết</th>
                      {activeDays.map((d) => (
                        <th key={d.id} className="th text-center">
                          {d.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPeriods.map((p) => (
                      <tr key={p.id}>
                        <td className="td text-xs text-slate-500">{p.name}</td>
                        {activeDays.map((d) => {
                          const entry = previewEntries.find((e) => e.dayId === d.id && e.periodId === p.id)
                          return (
                            <td key={d.id} className="td h-12 min-w-[100px] p-1 align-top">
                              {entry && (
                                <div
                                  className="flex h-full flex-col rounded-md border px-1.5 py-1 text-xs"
                                  style={{
                                    background: `${subjectOf(entry.subjectId)?.color ?? '#3b82f6'}1a`,
                                    borderColor: subjectOf(entry.subjectId)?.color ?? '#3b82f6'
                                  }}
                                >
                                  <div className="font-semibold">{subjectOf(entry.subjectId)?.name}</div>
                                  <div className="truncate text-slate-600">
                                    {teacherOf(entry.teacherId)?.shortName || teacherOf(entry.teacherId)?.code}
                                  </div>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div>
                <label className="label">Lưu thành phương án</label>
                <input
                  className="input w-64"
                  placeholder="Ví dụ: Phương án tự động 1"
                  value={applyName}
                  onChange={(e) => setApplyName(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={apply} disabled={!applyName.trim()}>
                Áp dụng (tạo phương án mới)
              </button>
              <button className="btn-ghost" onClick={discard}>
                Bỏ kết quả
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">Lịch sử chạy xếp tự động</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Thời điểm</th>
              <th className="th">Phạm vi</th>
              <th className="th">Chế độ</th>
              <th className="th">Trạng thái</th>
              <th className="th">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={5}>
                  Chưa có lần chạy nào.
                </td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="td">{j.startedAt ? new Date(j.startedAt).toLocaleString('vi-VN') : '—'}</td>
                <td className="td">{j.scope}</td>
                <td className="td">{j.mode === 'full' ? 'Đầy đủ' : 'Một phần'}</td>
                <td className="td">{j.status}</td>
                <td className="td text-slate-500">{j.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
