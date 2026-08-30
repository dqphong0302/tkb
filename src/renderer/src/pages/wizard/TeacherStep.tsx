import { useState } from 'react'
import type { Period, Teacher, TeachingDay } from '@shared/types'
import { EntityPage } from '../../components/EntityPage'
import { useList } from '../../lib/useList'
import { TeacherAvailabilityModal } from './TeacherAvailabilityModal'
import type { StepProps } from './types'

export function TeacherStep({ semesterId, onChanged }: StepProps) {
  const { items: days } = useList<TeachingDay>('day:list', { semesterId })
  const { items: periods } = useList<Period>('period:list', { semesterId })
  const [availabilityFor, setAvailabilityFor] = useState<Teacher | null>(null)

  return (
    <>
      <EntityPage
        channel="teacher"
        semesterId={semesterId}
        onChanged={onChanged}
        title="Giáo viên"
        description="Mã giáo viên là duy nhất trong một học kỳ."
        fields={[
          { key: 'code', label: 'Mã GV', type: 'text' },
          { key: 'fullName', label: 'Họ tên', type: 'text' },
          { key: 'shortName', label: 'Tên viết tắt', type: 'text', defaultValue: '' },
          { key: 'department', label: 'Tổ chuyên môn', type: 'text', defaultValue: '' },
          { key: 'color', label: 'Màu', type: 'color', defaultValue: '#10b981', hideInTable: true },
          {
            key: 'maxPeriodsPerDay',
            label: 'Tối đa tiết/ngày',
            type: 'number',
            defaultValue: 5,
            min: 1,
            max: 15
          },
          { key: 'avoidGaps', label: 'Ưu tiên ít tiết trống', type: 'checkbox', defaultValue: 0 },
          { key: 'note', label: 'Ghi chú', type: 'text', defaultValue: '', hideInTable: true },
          {
            key: 'availability',
            label: 'Lịch bận',
            type: 'text',
            hideInForm: true,
            format: (row: Teacher) => (
              <button className="btn-ghost" onClick={() => setAvailabilityFor(row)}>
                Khai báo lịch bận…
              </button>
            )
          }
        ]}
      />
      {availabilityFor && (
        <TeacherAvailabilityModal
          semesterId={semesterId}
          teacher={availabilityFor}
          days={days}
          periods={periods}
          onClose={() => setAvailabilityFor(null)}
        />
      )}
    </>
  )
}
