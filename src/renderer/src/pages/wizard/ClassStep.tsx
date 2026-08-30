import { EntityPage } from '../../components/EntityPage'
import { useList } from '../../lib/useList'
import { useState } from 'react'
import type { Grade, Room } from '@shared/types'
import { SHIFT_LABEL } from '@shared/constants'
import { Alert } from '../../components/Alert'
import type { StepProps } from './types'
import { SlotAvailabilityModal } from './SlotAvailabilityModal'

export function ClassStep({ semesterId, onChanged }: StepProps) {
  const { items: grades } = useList<Grade>('grade:list', { semesterId })
  const { items: rooms } = useList<Room>('room:list', { semesterId })
  const [availabilityClass, setAvailabilityClass] = useState<{ id: number; label: string } | null>(null)

  if (grades.length === 0) {
    return <Alert tone="warn">Cần khai báo ít nhất một khối trước khi thêm lớp.</Alert>
  }

  return (
    <>
    <EntityPage
      channel="class"
      semesterId={semesterId}
      onChanged={onChanged}
      title="Lớp"
      description="Mã lớp là duy nhất trong một học kỳ."
      fields={[
        { key: 'code', label: 'Mã lớp', type: 'text' },
        { key: 'name', label: 'Tên lớp', type: 'text' },
        {
          key: 'gradeId',
          label: 'Khối',
          type: 'select',
          defaultValue: grades[0]?.id,
          options: grades.map((g) => ({ value: g.id, label: g.name }))
        },
        {
          key: 'shift',
          label: 'Ca học',
          type: 'select',
          defaultValue: 'morning',
          options: (['morning', 'afternoon', 'full'] as const).map((s) => ({
            value: s,
            label: SHIFT_LABEL[s]
          }))
        },
        {
          key: 'maxPeriodsPerDay',
          label: 'Tối đa tiết/ngày',
          type: 'number',
          defaultValue: 5,
          min: 1,
          max: 15
        },
        {
          key: 'roomId',
          label: 'Phòng cố định',
          type: 'select',
          nullable: true,
          defaultValue: null,
          hideInTable: true,
          options: rooms.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))
        },
        { key: 'orderNo', label: 'Thứ tự', type: 'number', defaultValue: 0, hideInTable: true }
      ]}
      rowActions={(row) => <button className="btn-ghost" onClick={() => setAvailabilityClass({ id: row.id, label: `${row.code} - ${row.name}` })}>Lịch nghỉ</button>}
    />
    {availabilityClass && <SlotAvailabilityModal kind="class" entityId={availabilityClass.id} name={availabilityClass.label} semesterId={semesterId} open onClose={() => setAvailabilityClass(null)} />}
    </>
  )
}
