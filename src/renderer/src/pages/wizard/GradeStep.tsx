import { EntityPage } from '../../components/EntityPage'
import type { StepProps } from './types'

export function GradeStep({ semesterId, onChanged }: StepProps) {
  return (
    <EntityPage
      channel="grade"
      semesterId={semesterId}
      onChanged={onChanged}
      title="Khối"
      description="Khai báo các khối của trường, ví dụ Khối 6, Khối 7."
      fields={[
        { key: 'name', label: 'Tên khối', type: 'text' },
        { key: 'orderNo', label: 'Thứ tự', type: 'number', defaultValue: 0 }
      ]}
    />
  )
}
