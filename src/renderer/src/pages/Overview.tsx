import { useEffect, useState } from 'react'
import type { WizardStepStatus } from '@shared/types'
import { WIZARD_STEPS } from '@shared/constants'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'

export function OverviewPage({
  semesterId,
  version,
  onGoWizard,
  onGoStep
}: {
  semesterId: number
  version: number
  onGoWizard: () => void
  onGoStep?: (stepIndex: number) => void
}) {
  const [steps, setSteps] = useState<WizardStepStatus[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    call<WizardStepStatus[]>('wizard:status', { semesterId })
      .then(setSteps)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [semesterId, version])

  const required = steps.filter((s) => !s.optional)
  const doneCount = required.filter((s) => s.done).length
  const issues = steps.flatMap((s) => s.issues)

  const percent = required.length ? Math.round((doneCount / required.length) * 100) : 0

  return (
    <div className="space-y-6">
      <section className="overview-hero">
        <div>
          <span className="hero-kicker">Thiết lập thời khóa biểu</span>
          <h2>Sẵn sàng xếp lịch cho học kỳ này</h2>
          <p>Hoàn thiện dữ liệu đầu vào theo thứ tự để việc phân công và xếp lịch chính xác hơn.</p>
          <button id="continue-setup" className="btn-primary mt-5" onClick={onGoWizard}>
            {doneCount === 0 ? 'Bắt đầu khai báo' : 'Tiếp tục khai báo'} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="progress-orbit" style={{ '--progress': `${percent * 3.6}deg` } as React.CSSProperties}>
          <div>
            <strong>{percent}%</strong>
            <span>hoàn thành</span>
          </div>
        </div>
      </section>

      {error && <Alert>{error}</Alert>}

      <section className="card step-card">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Quy trình đề xuất</span>
            <h2>{WIZARD_STEPS.length} bước khai báo dữ liệu</h2>
          </div>
          <span className="completion-pill">{doneCount}/{required.length} bước bắt buộc</span>
        </div>
        <div className="step-grid">
        {WIZARD_STEPS.map((def, i) => {
          const st = steps.find((s) => s.key === def.key)
          const done = st?.done ?? false
          return (
            <button
              key={def.key}
              id={`overview-step-${def.key}`}
              onClick={() => (onGoStep ? onGoStep(i) : onGoWizard())}
              className={`overview-step overview-step-clickable ${done ? 'overview-step-done' : ''}`}
            >
              <div className="step-number">{done ? '✓' : i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="step-title flex items-center justify-between">
                  <span>{def.title}</span>
                  <span className="text-slate-400 text-xs opacity-0 transition group-hover:opacity-100">→</span>
                </div>
                <div className="step-meta">
                  {done ? 'Đã hoàn thành' : def.optional ? 'Không bắt buộc' : 'Cần khai báo'} · {st?.count ?? 0} bản ghi
                </div>
              </div>
            </button>
          )
        })}
        </div>
      </section>

      {issues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Cảnh báo dữ liệu</h3>
          {issues.map((msg, i) => (
            <Alert key={i} tone="warn">
              {msg}
            </Alert>
          ))}
        </div>
      )}
    </div>
  )
}
