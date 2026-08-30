import { useCallback, useEffect, useState } from 'react'
import type { WizardStepStatus } from '@shared/types'
import { WIZARD_STEPS } from '@shared/constants'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'
import { GradeStep } from './wizard/GradeStep'
import { ClassStep } from './wizard/ClassStep'
import { CalendarStep } from './wizard/CalendarStep'
import { RoomStep } from './wizard/RoomStep'
import { SubjectStep } from './wizard/SubjectStep'
import { TeacherStep } from './wizard/TeacherStep'
import { HomeroomStep } from './wizard/HomeroomStep'
import { AssignmentPage } from './wizard/AssignmentStep'
import { PeriodsStep } from './wizard/PeriodsStep'

export function WizardPage({
  semesterId,
  initialStepIndex = 0,
  onStepChange,
  onChanged
}: {
  semesterId: number
  initialStepIndex?: number
  onStepChange?: (index: number) => void
  onChanged: () => void
}) {
  const [index, setIndex] = useState(initialStepIndex)
  const [steps, setSteps] = useState<WizardStepStatus[]>([])

  useEffect(() => {
    setIndex(initialStepIndex)
  }, [initialStepIndex])

  const changeIndex = (newIdx: number) => {
    setIndex(newIdx)
    onStepChange?.(newIdx)
  }

  const refresh = useCallback(() => {
    void call<WizardStepStatus[]>('wizard:status', { semesterId }).then(setSteps)
    onChanged()
  }, [semesterId, onChanged])

  useEffect(() => {
    void call<WizardStepStatus[]>('wizard:status', { semesterId }).then(setSteps)
  }, [semesterId])

  const current = WIZARD_STEPS[index]
  const status = steps.find((s) => s.key === current.key)
  const props = { semesterId, onChanged: refresh }

  return (
    <div className="space-y-5">
      <div className="section-heading">
        <div>
          <span className="section-kicker">Khai báo dữ liệu</span>
          <h2>Thiết lập theo từng bước</h2>
          <p>Đi lần lượt từ trái sang phải. Bạn có thể quay lại chỉnh sửa bất cứ lúc nào.</p>
        </div>
        <span className="completion-pill">Bước {index + 1}/{WIZARD_STEPS.length}</span>
      </div>
      <ol className="wizard-steps">
        {WIZARD_STEPS.map((s, i) => {
          const st = steps.find((x) => x.key === s.key)
          const active = i === index
          return (
            <li key={s.key}>
              <button
                onClick={() => changeIndex(i)}
                id={`wizard-step-${s.key}`}
                className={`wizard-step ${
                  active
                    ? 'wizard-step-active'
                    : st?.done
                      ? 'wizard-step-done'
                      : ''
                }`}
              >
                <span>{st?.done ? '✓' : i + 1}</span>
                <small>{s.title}</small>
              </button>
            </li>
          )
        })}
      </ol>

      {status && status.issues.length > 0 && (
        <div className="space-y-1.5">
          {status.issues.map((msg, i) => (
            <Alert key={i} tone="warn">
              {msg}
            </Alert>
          ))}
        </div>
      )}

      <div className="card wizard-content p-5">
        {current.key === 'grade' && <GradeStep {...props} />}
        {current.key === 'class' && <ClassStep {...props} />}
        {current.key === 'calendar' && <CalendarStep {...props} />}
        {current.key === 'room' && <RoomStep {...props} />}
        {current.key === 'subject' && <SubjectStep {...props} />}
        {current.key === 'teacher' && <TeacherStep {...props} />}
        {current.key === 'homeroom' && <HomeroomStep {...props} />}
        {current.key === 'assignment' && <AssignmentPage {...props} />}
        {current.key === 'periodsPerWeek' && <PeriodsStep {...props} />}
      </div>

      <div className="flex justify-between">
        <button id="wizard-previous" className="btn-ghost" disabled={index === 0} onClick={() => changeIndex(index - 1)}>
          ← Bước trước
        </button>
        <button
          id="wizard-next"
          className="btn-primary"
          disabled={index === WIZARD_STEPS.length - 1}
          onClick={() => changeIndex(index + 1)}
        >
          Bước tiếp theo →
        </button>
      </div>
    </div>
  )
}
