import { EntityPage } from '../../components/EntityPage'
import { useList } from '../../lib/useList'
import type { Grade, Room, Subject } from '@shared/types'
import { SubjectGradesCell } from './SubjectGradesCell'
import type { StepProps } from './types'

export function SubjectStep({ semesterId, onChanged }: StepProps) {
  const { items: rooms } = useList<Room>('room:list', { semesterId })
  const { items: grades } = useList<Grade>('grade:list', { semesterId })
  return (
    <EntityPage
      channel="subject"
      semesterId={semesterId}
      onChanged={onChanged}
      title="Môn học"
      description="Khai báo môn, màu hiển thị và các giới hạn dùng khi xếp lịch."
      fields={[
        { key: 'code', label: 'Mã nội bộ', type: 'text', hideInTable: true, hideInForm: true, autoGenerate: true },
        { key: 'name', label: 'Tên môn', type: 'text' },
        {
          key: 'grades',
          label: 'Khối áp dụng',
          type: 'text',
          hideInForm: true,
          format: (row: Subject) => <SubjectGradesCell subject={row} grades={grades} />
        },
        { key: 'color', label: 'Màu', type: 'color', defaultValue: '#3b82f6' },
        { key: 'orderNo', label: 'Thứ tự', type: 'number', defaultValue: 0 },
        { key: 'allowDouble', label: 'Cho phép tiết đôi', type: 'checkbox', defaultValue: 0 },
        { key: 'maxPerDay', label: 'Tối đa/ngày', type: 'number', defaultValue: 2, min: 1, max: 10 },
        {
          key: 'minGapDays',
          label: 'Khoảng cách ngày tối thiểu',
          type: 'number',
          defaultValue: 0,
          min: 0,
          max: 6
        },
        {
          key: 'requiresSpecialRoom',
          label: 'Cần phòng chuyên môn',
          type: 'checkbox',
          defaultValue: 0
        },
        {
          key: 'roomId',
          label: 'Phòng mặc định',
          type: 'select',
          nullable: true,
          defaultValue: null,
          hideInTable: true,
          options: rooms.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))
        }
      ]}
    />
  )
}
