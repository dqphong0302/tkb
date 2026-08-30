import { useCallback, useEffect, useState } from 'react'
import type { Bootstrap } from '@shared/types'
import { call } from './lib/api'
import { SetupPage } from './pages/Setup'
import { OverviewPage } from './pages/Overview'
import { WizardPage } from './pages/Wizard'
import { AssignmentPage } from './pages/wizard/AssignmentStep'
import { SettingsPage } from './pages/Settings'
import { StatisticsPage } from './pages/Statistics'
import { TimetablePage } from './pages/Timetable'
import { DataToolsPage } from './pages/DataTools'
import { Alert } from './components/Alert'

type Tab = 'overview' | 'wizard' | 'assignment' | 'timetable' | 'data' | 'stats' | 'settings'

const TABS: { key: Tab; label: string; hint: string; icon: string }[] = [
  { key: 'overview', label: 'Tổng quan', hint: 'Tiến độ học kỳ', icon: '⌂' },
  { key: 'wizard', label: 'Khai báo dữ liệu', hint: 'Thiết lập từng bước', icon: '✦' },
  { key: 'assignment', label: 'Phân công', hint: 'Giáo viên & lớp', icon: '⇄' },
  { key: 'timetable', label: 'Xếp thời khóa biểu', hint: 'Xếp tay và tự động', icon: '▦' },
  { key: 'data', label: 'Nhập / Xuất', hint: 'Excel, in và sao lưu', icon: '⇩' },
  { key: 'stats', label: 'Thống kê', hint: 'Kiểm tra dữ liệu', icon: '◫' },
  { key: 'settings', label: 'Cài đặt', hint: 'Trường & học kỳ', icon: '⚙' }
]

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [wizardStep, setWizardStep] = useState(0)
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    try {
      setBoot(await call<Bootstrap>('app:bootstrap'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const notifyChanged = useCallback(() => setVersion((v) => v + 1), [])

  if (error) {
    return (
      <div className="p-8">
        <Alert>{error}</Alert>
      </div>
    )
  }

  if (!boot) return <div className="p-8 text-sm text-slate-500">Đang tải…</div>

  if (!boot.school || !boot.semester) {
    return <SetupPage onDone={load} />
  }

  const semesterId = boot.semester.id

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <div className="brand-mark">TKB</div>
          <div>
            <div className="brand-name">Thời khóa biểu</div>
            <div className="brand-tagline">Xếp lịch thông minh</div>
          </div>
        </div>

        <nav className="app-nav" aria-label="Điều hướng chính">
          <div className="nav-section-label">Không gian làm việc</div>
          {TABS.map((t) => (
            <button
              id={`nav-${t.key}`}
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`nav-item ${tab === t.key ? 'nav-item-active' : ''}`}
              aria-current={tab === t.key ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{t.icon}</span>
              <span className="min-w-0 text-left">
                <span className="nav-label">{t.label}</span>
                <span className="nav-hint">{t.hint}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <span className="sidebar-tip-icon">?</span>
          <div>
            <strong>Gợi ý</strong>
            <p>Bắt đầu từ Khai báo dữ liệu, sau đó Phân công và Xếp tự động.</p>
          </div>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-header">
          <div>
            <p className="page-eyebrow">Năm học {boot.years.find((y) => y.id === boot.semester?.academicYearId)?.name}</p>
            <h1 className="page-title">{boot.school.name}</h1>
          </div>
          <label className="semester-picker">
            <span>Học kỳ đang làm việc</span>
            <select
              id="active-semester"
              className="input w-60"
              value={semesterId}
              onChange={async (e) => {
                await call('semester:activate', { id: Number(e.target.value) })
                await load()
                notifyChanged()
              }}
            >
              {boot.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {boot.years.find((y) => y.id === s.academicYearId)?.name} · {s.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        <main className="app-main">
        {tab === 'overview' && (
          <OverviewPage
            semesterId={semesterId}
            version={version}
            onGoWizard={() => setTab('wizard')}
            onGoStep={(stepIdx) => {
              setWizardStep(stepIdx)
              setTab('wizard')
            }}
          />
        )}
        {tab === 'wizard' && (
          <WizardPage
            semesterId={semesterId}
            initialStepIndex={wizardStep}
            onStepChange={setWizardStep}
            onChanged={notifyChanged}
          />
        )}
        {tab === 'assignment' && (
          <AssignmentPage semesterId={semesterId} onChanged={notifyChanged} />
        )}
        {tab === 'timetable' && <TimetablePage semesterId={semesterId} />}
        {tab === 'data' && <DataToolsPage semesterId={semesterId} onChanged={notifyChanged} />}
        {tab === 'stats' && (
          <StatisticsPage semesterId={semesterId} school={boot.school} version={version} />
        )}
        {tab === 'settings' && <SettingsPage boot={boot} onChanged={load} />}
        </main>
      </div>
    </div>
  )
}
