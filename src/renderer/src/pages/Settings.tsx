import { useEffect, useMemo, useState } from 'react'
import type { Bootstrap } from '@shared/types'
import {
  LEVEL_LABEL,
  SYSTEM_CONSTRAINTS,
  CONSTRAINT_PRESETS,
  type ConstraintDefinition
} from '@shared/constants'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'
import { ConfirmButton } from '../components/Modal'

type Level = 0 | 1 | 2 | 3
type SettingsTab = 'school' | 'constraints' | 'audit'

export function SettingsPage({ boot, onChanged }: { boot: Bootstrap; onChanged: () => void }) {
  const school = boot.school!
  const semesterId = boot.semester?.id

  const [activeTab, setActiveTab] = useState<SettingsTab>('constraints')
  const [name, setName] = useState(school.name)
  const [address, setAddress] = useState(school.address)
  const [principal, setPrincipal] = useState(school.principal)
  const [maxPeriodsPerWeek, setMaxPeriodsPerWeek] = useState(school.maxPeriodsPerWeek)
  const [yearName, setYearName] = useState('')
  const [semesterName, setSemesterName] = useState('')
  const [yearId, setYearId] = useState<number>(boot.years[0]?.id ?? 0)

  // Constraints & Solver settings
  const [teacherGaps, setTeacherGaps] = useState<Level>(2)
  const [subjectSpread, setSubjectSpread] = useState<Level>(2)
  const [teacherPrefer, setTeacherPrefer] = useState<Level>(1)
  const [avoidSinglePeriod, setAvoidSinglePeriod] = useState<Level>(2)
  const [softDoublePairs, setSoftDoublePairs] = useState<Level>(1)
  const [timeLimit, setTimeLimit] = useState(120)
  const [solverMode, setSolverMode] = useState<'full' | 'partial'>('full')
  const [activePreset, setActivePreset] = useState<string | null>('thcs')

  // Filter for audit matrix
  const [filterKind, setFilterKind] = useState<'all' | 'hard' | 'soft'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [savingConstraints, setSavingConstraints] = useState(false)

  const loadConstraints = async () => {
    if (!semesterId) return
    try {
      const list = await call<{ key: string; level: string }[]>('constraint:list', { semesterId })
      if (list && list.length > 0) {
        const cmap = new Map(list.map((it) => [it.key, it.level]))
        if (cmap.has('teacherGaps')) setTeacherGaps(Number(cmap.get('teacherGaps')) as Level)
        if (cmap.has('subjectSpread')) setSubjectSpread(Number(cmap.get('subjectSpread')) as Level)
        if (cmap.has('teacherPrefer')) setTeacherPrefer(Number(cmap.get('teacherPrefer')) as Level)
        if (cmap.has('avoidSinglePeriod')) setAvoidSinglePeriod(Number(cmap.get('avoidSinglePeriod')) as Level)
        if (cmap.has('softDoublePairs')) setSoftDoublePairs(Number(cmap.get('softDoublePairs')) as Level)
        if (cmap.has('timeLimit')) setTimeLimit(Number(cmap.get('timeLimit')))
        if (cmap.has('mode') && (cmap.get('mode') === 'full' || cmap.get('mode') === 'partial')) {
          setSolverMode(cmap.get('mode') as 'full' | 'partial')
        }
        if (cmap.has('presetId')) setActivePreset(cmap.get('presetId') ?? null)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadConstraints()
  }, [semesterId])

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      onChanged()
      setError(null)
      setMessage(ok)
    } catch (err) {
      setMessage(null)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveConstraints() {
    if (!semesterId) return
    setSavingConstraints(true)
    setError(null)
    setMessage(null)
    try {
      await call('constraint:setMany', {
        semesterId,
        items: [
          { key: 'teacherGaps', level: String(teacherGaps) },
          { key: 'subjectSpread', level: String(subjectSpread) },
          { key: 'teacherPrefer', level: String(teacherPrefer) },
          { key: 'avoidSinglePeriod', level: String(avoidSinglePeriod) },
          { key: 'softDoublePairs', level: String(softDoublePairs) },
          { key: 'timeLimit', level: String(timeLimit) },
          { key: 'mode', level: solverMode },
          { key: 'presetId', level: activePreset ?? 'custom' }
        ]
      })
      setMessage('Đã lưu cấu hình ràng buộc và tiêu chí tối ưu cho học kỳ này.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingConstraints(false)
    }
  }

  function applyPreset(presetId: string) {
    const p = CONSTRAINT_PRESETS.find((x) => x.id === presetId)
    if (!p) return
    setTeacherGaps(p.weights.teacherGaps)
    setSubjectSpread(p.weights.subjectSpread)
    setTeacherPrefer(p.weights.teacherPrefer)
    setAvoidSinglePeriod(p.weights.avoidSinglePeriod)
    setSoftDoublePairs(p.weights.softDoublePairs)
    setTimeLimit(p.timeLimit)
    setSolverMode(p.mode)
    setActivePreset(p.id)
  }

  const filteredConstraints = useMemo(() => {
    return SYSTEM_CONSTRAINTS.filter((c: ConstraintDefinition) => {
      if (filterKind !== 'all' && c.kind !== filterKind) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.configuredIn.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [filterKind, searchQuery])

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <span className="section-kicker">Quản trị & Cài đặt</span>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Cấu hình Hệ thống & Ràng buộc Xếp lịch</h2>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý thông tin trường, niên khóa, định mức và thiết lập chính sách ràng buộc cho bộ giải thời khóa biểu.
          </p>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="info">{message}</Alert>}

      {/* Settings Navigation Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'constraints'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => setActiveTab('constraints')}
        >
          ⚙ Cấu hình Ràng buộc & Bộ giải
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => setActiveTab('audit')}
        >
          📋 Ma trận 13 Ràng buộc Hệ thống
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'school'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
          onClick={() => setActiveTab('school')}
        >
          🏫 Trường & Học kỳ
        </button>
      </div>

      {/* TAB 1: CONSTRAINTS & SOLVER POLICY */}
      {activeTab === 'constraints' && (
        <div className="space-y-6">
          {/* Quick Presets */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">1. Mẫu cấu hình nhanh theo Cấp học (Presets)</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Chọn mẫu để tự động điền các trọng số tối ưu phù hợp với mô hình đào tạo của trường.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {CONSTRAINT_PRESETS.map((p) => {
                const isSelected = activePreset === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.id)}
                    className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <strong className="text-sm text-slate-900">{p.name}</strong>
                      {isSelected && <span className="text-xs font-bold text-blue-600">✓ Đang chọn</span>}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{p.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {p.timeLimit}s
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        Tiết trống: {LEVEL_LABEL[(['off', 'low', 'medium', 'high'] as const)[p.weights.teacherGaps]]}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Soft Constraints Weights & Parameters */}
          <section className="card p-5">
            <h3 className="text-base font-bold text-slate-900">2. Trọng số 5 Tiêu chí Tối ưu hóa Mềm</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Bộ giải OR-Tools CP-SAT sử dụng các mức này để tính điểm phạt/thưởng khi tìm kiếm phương án lịch tốt nhất.
            </p>

            <div className="mt-4 space-y-3">
              {[
                {
                  key: 'teacherGaps',
                  title: 'Giảm tiết trống của Giáo viên (Teacher Gaps)',
                  desc: 'Hạn chế tối đa các tiết rảnh nằm xen giữa tiết đầu và tiết cuối trong cùng một buổi dạy của giáo viên.',
                  value: teacherGaps,
                  setter: (v: Level) => {
                    setTeacherGaps(v)
                    setActivePreset(null)
                  }
                },
                {
                  key: 'subjectSpread',
                  title: 'Phân bố Môn đều trong tuần (Subject Spread)',
                  desc: 'Tránh dồn nhiều tiết của cùng một môn vào một ngày, ưu tiên trải đều các ngày trong tuần.',
                  value: subjectSpread,
                  setter: (v: Level) => {
                    setSubjectSpread(v)
                    setActivePreset(null)
                  }
                },
                {
                  key: 'teacherPrefer',
                  title: 'Ưu tiên Tiết mong muốn của Giáo viên (Teacher Preference)',
                  desc: 'Thưởng điểm khi xếp giáo viên vào các khung giờ giáo viên đăng ký ưu tiên dạy.',
                  value: teacherPrefer,
                  setter: (v: Level) => {
                    setTeacherPrefer(v)
                    setActivePreset(null)
                  }
                },
                {
                  key: 'avoidSinglePeriod',
                  title: 'Hạn chế Giáo viên chỉ dạy 1 tiết / buổi (Avoid Single Period)',
                  desc: 'Tránh trường hợp giáo viên chỉ đến trường dạy đúng 1 tiết rồi về trong một buổi sáng hoặc chiều.',
                  value: avoidSinglePeriod,
                  setter: (v: Level) => {
                    setAvoidSinglePeriod(v)
                    setActivePreset(null)
                  }
                },
                {
                  key: 'softDoublePairs',
                  title: 'Ưu tiên ghép Tiết đôi không bắt buộc (Soft Double Periods)',
                  desc: 'Ưu tiên xếp 2 tiết liền nhau cho các môn cho phép tiết đôi khi phân công không đánh dấu bắt buộc cứng.',
                  value: softDoublePairs,
                  setter: (v: Level) => {
                    setSoftDoublePairs(v)
                    setActivePreset(null)
                  }
                }
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition hover:bg-slate-50"
                >
                  <div className="max-w-xl">
                    <strong className="text-sm font-semibold text-slate-800">{item.title}</strong>
                    <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      className="input w-36 font-medium"
                      value={item.value}
                      onChange={(e) => item.setter(Number(e.target.value) as Level)}
                    >
                      {[0, 1, 2, 3].map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {LEVEL_LABEL[(['off', 'low', 'medium', 'high'] as const)[lvl]]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <label className="label">Thời gian chạy giải mặc định (giây)</label>
                <input
                  className="input"
                  type="number"
                  min={10}
                  max={600}
                  value={timeLimit}
                  onChange={(e) => {
                    setTimeLimit(Number(e.target.value))
                    setActivePreset(null)
                  }}
                />
                <p className="mt-1 text-xs text-slate-400">Khuyến nghị: 60s (trường nhỏ), 120s–180s (trường 20–40 lớp).</p>
              </div>
              <div>
                <label className="label">Chế độ giải mặc định</label>
                <select
                  className="input"
                  value={solverMode}
                  onChange={(e) => {
                    setSolverMode(e.target.value as 'full' | 'partial')
                    setActivePreset(null)
                  }}
                >
                  <option value="full">Đầy đủ (Full) — Phải xếp đủ 100% tiết</option>
                  <option value="partial">Một phần (Partial) — Chẩn đoán tiết vướng</option>
                </select>
                <p className="mt-1 text-xs text-slate-400">Chế độ một phần hữu ích khi dữ liệu quá chặt gây vô nghiệm.</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button className="btn-primary" disabled={savingConstraints} onClick={saveConstraints}>
                {savingConstraints ? 'Đang lưu…' : 'Lưu cấu hình ràng buộc'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: AUDIT MATRIX (13 CONSTRAINTS) */}
      {activeTab === 'audit' && (
        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Ma trận 13 Ràng buộc Thời khóa biểu</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Toàn bộ ràng buộc cứng và mềm được kiểm tra bởi bộ giải OR-Tools CP-SAT theo thiết kế của dự án.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="input w-52"
                placeholder="Tìm quy tắc ràng buộc…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex rounded-lg bg-slate-100 p-1">
                <button
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    filterKind === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setFilterKind('all')}
                >
                  Tất cả ({SYSTEM_CONSTRAINTS.length})
                </button>
                <button
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    filterKind === 'hard' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setFilterKind('hard')}
                >
                  Bắt buộc (13)
                </button>
                <button
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    filterKind === 'soft' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                  }`}
                  onClick={() => setFilterKind('soft')}
                >
                  Tối ưu mềm (5)
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th w-14 text-center">Mã</th>
                  <th className="th w-28">Phân loại</th>
                  <th className="th w-56">Tên quy tắc</th>
                  <th className="th">Mô tả nghiệp vụ</th>
                  <th className="th w-44">Nơi cấu hình</th>
                  <th className="th w-32 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredConstraints.map((c) => {
                  const isHard = c.kind === 'hard'
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="td text-center font-mono font-bold text-slate-700">{c.code}</td>
                      <td className="td">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            isHard
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}
                        >
                          {isHard ? 'Bắt buộc' : 'Tối ưu mềm'}
                        </span>
                      </td>
                      <td className="td font-semibold text-slate-800">{c.name}</td>
                      <td className="td text-xs leading-relaxed text-slate-600">{c.description}</td>
                      <td className="td text-xs text-slate-500">{c.configuredIn}</td>
                      <td className="td text-center">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          ✓ Đang hiệu lực
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: SCHOOL & SEMESTER INFO */}
      {activeTab === 'school' && (
        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="mb-3 text-base font-semibold">Thông tin trường</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Tên trường</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Địa chỉ</label>
                <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div>
                <label className="label">Hiệu trưởng</label>
                <input className="input" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </div>
              <div>
                <label className="label">Số tiết tối đa mỗi tuần (định mức, dùng cho báo cáo thống kê)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={maxPeriodsPerWeek}
                  onChange={(e) => setMaxPeriodsPerWeek(Number(e.target.value))}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Để 0 nếu không muốn giới hạn. Trang Thống kê sẽ dùng số này để cảnh báo giáo viên dạy vượt định mức.
                </p>
              </div>
            </div>
            <button
              className="btn-primary mt-4"
              onClick={() =>
                run(
                  () =>
                    call('school:update', {
                      id: school.id,
                      name,
                      address,
                      principal,
                      maxPeriodsPerWeek
                    }),
                  'Đã lưu thông tin trường.'
                )
              }
            >
              Lưu thông tin trường
            </button>
          </section>

          <section className="card p-5">
            <h3 className="mb-3 text-base font-semibold">Năm học và học kỳ</h3>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Năm học</th>
                  <th className="th">Học kỳ</th>
                  <th className="th w-32">Trạng thái</th>
                  <th className="th w-28 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {boot.semesters.map((s) => (
                  <tr key={s.id}>
                    <td className="td">{boot.years.find((y) => y.id === s.academicYearId)?.name}</td>
                    <td className="td">{s.name}</td>
                    <td className="td">
                      {s.isActive ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700 font-semibold">
                          Đang dùng
                        </span>
                      ) : (
                        <button
                          className="text-xs text-blue-600 hover:underline font-semibold"
                          onClick={() => run(() => call('semester:activate', { id: s.id }), 'Đã chuyển học kỳ.')}
                        >
                          Chọn
                        </button>
                      )}
                    </td>
                    <td className="td text-right">
                      <ConfirmButton
                        label="Xóa"
                        message="Xóa học kỳ sẽ xóa toàn bộ dữ liệu của học kỳ đó. Tiếp tục?"
                        onConfirm={() => run(() => call('semester:delete', { id: s.id }), 'Đã xóa học kỳ.')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="label">Thêm năm học</label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="2027–2028"
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                  />
                  <button
                    className="btn-ghost"
                    onClick={() =>
                      run(async () => {
                        await call('year:create', { name: yearName })
                        setYearName('')
                      }, 'Đã thêm năm học.')
                    }
                  >
                    Thêm
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Thêm học kỳ</label>
                <div className="flex gap-2">
                  <select
                    className="input w-40"
                    value={yearId}
                    onChange={(e) => setYearId(Number(e.target.value))}
                  >
                    {boot.years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    placeholder="Học kỳ 2"
                    value={semesterName}
                    onChange={(e) => setSemesterName(e.target.value)}
                  />
                  <button
                    className="btn-ghost"
                    onClick={() =>
                      run(async () => {
                        await call('semester:create', {
                          academicYearId: yearId,
                          name: semesterName,
                          orderNo: boot.semesters.filter((s) => s.academicYearId === yearId).length + 1
                        })
                        setSemesterName('')
                      }, 'Đã thêm học kỳ.')
                    }
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
