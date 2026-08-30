import { useEffect, useState } from 'react'
import type { Grade, Subject } from '@shared/types'
import { call } from '../../lib/api'
import { Modal } from '../../components/Modal'

export function SubjectGradesCell({ subject, grades }: { subject: Subject; grades: Grade[] }) {
  const [gradeIds, setGradeIds] = useState<number[] | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number[]>([])

  useEffect(() => {
    call<number[]>('subjectGrade:list', { subjectId: subject.id }).then(setGradeIds)
  }, [subject.id])

  function openEdit() {
    setDraft(gradeIds ?? [])
    setOpen(true)
  }

  async function save() {
    await call('subjectGrade:set', { subjectId: subject.id, gradeIds: draft })
    setGradeIds(draft)
    setOpen(false)
  }

  if (gradeIds === null) return <span className="text-xs text-slate-400">…</span>

  const label =
    gradeIds.length === 0
      ? 'Tất cả khối'
      : gradeIds
          .map((id) => grades.find((g) => g.id === id)?.name)
          .filter(Boolean)
          .join(', ')

  return (
    <>
      <button className="text-left text-xs text-blue-600 hover:underline" onClick={openEdit}>
        {label}
      </button>
      <Modal
        title={`Khối áp dụng — ${subject.name}`}
        open={open}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              Hủy
            </button>
            <button className="btn-primary" onClick={save}>
              Lưu
            </button>
          </>
        }
      >
        <p className="mb-2 text-xs text-slate-500">
          Không chọn khối nào nghĩa là môn áp dụng cho tất cả khối. Chỗ nào không áp dụng sẽ không hiện ở màn Phân
          công giảng dạy của lớp thuộc khối đó.
        </p>
        <div className="space-y-1.5">
          {grades.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.includes(g.id)}
                onChange={(e) =>
                  setDraft((prev) => (e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id)))
                }
              />
              {g.name}
            </label>
          ))}
          {grades.length === 0 && <p className="text-sm text-slate-400">Chưa có khối nào.</p>}
        </div>
      </Modal>
    </>
  )
}
