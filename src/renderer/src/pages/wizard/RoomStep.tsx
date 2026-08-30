import { EntityPage } from '../../components/EntityPage'
import { useState } from 'react'
import { SlotAvailabilityModal } from './SlotAvailabilityModal'
import type { StepProps } from './types'

export function RoomStep({ semesterId, onChanged }: StepProps) {
  const [availabilityRoom, setAvailabilityRoom] = useState<{ id: number; label: string } | null>(null)
  return (
    <>
    <EntityPage
      channel="room"
      semesterId={semesterId}
      onChanged={onChanged}
      title="Phòng học"
      description="Bước tùy chọn. Bỏ trống nếu trường không dùng phòng chuyên môn."
      fields={[
        { key: 'code', label: 'Mã phòng', type: 'text' },
        { key: 'name', label: 'Tên phòng', type: 'text' },
        {
          key: 'kind',
          label: 'Loại phòng',
          type: 'select',
          defaultValue: 'normal',
          options: [
            { value: 'normal', label: 'Phòng thường' },
            { value: 'special', label: 'Phòng chuyên môn' }
          ]
        },
        { key: 'capacity', label: 'Sức chứa', type: 'number', defaultValue: 0 },
        { key: 'note', label: 'Ghi chú', type: 'text', defaultValue: '' }
      ]}
      rowActions={(row) => <button className="btn-ghost" onClick={() => setAvailabilityRoom({ id: row.id, label: `${row.code} - ${row.name}` })}>Lịch nghỉ</button>}
    />
    {availabilityRoom && <SlotAvailabilityModal kind="room" entityId={availabilityRoom.id} name={availabilityRoom.label} semesterId={semesterId} open onClose={() => setAvailabilityRoom(null)} />}
    </>
  )
}
