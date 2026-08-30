import { useEffect, useState } from 'react'
import type { SchoolClass, Teacher, Timetable } from '@shared/types'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'

interface ImportPreview {
  token: string
  fileName: string
  errors: string[]
  sheets: { name: string; count: number; sample: Record<string, unknown>[] }[]
}

interface BackupRecord { id: number; filePath: string; createdAt: number; appVersion: string }

export function DataToolsPage({ semesterId, onChanged }: { semesterId: number; onChanged: () => void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [timetables, setTimetables] = useState<Timetable[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [timetableId, setTimetableId] = useState<number | null>(null)
  const [publicationScope, setPublicationScope] = useState<'school' | 'class' | 'teacher'>('school')
  const [publicationTargetId, setPublicationTargetId] = useState<number | null>(null)
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      call<Timetable[]>('timetable:list', { semesterId }),
      call<SchoolClass[]>('class:list', { semesterId }),
      call<Teacher[]>('teacher:list', { semesterId }),
      call<BackupRecord[]>('backup:list', { semesterId })
    ]).then(([items, classItems, teacherItems, backupItems]) => {
      setTimetables(items)
      setClasses(classItems)
      setTeachers(teacherItems)
      setTimetableId(items.find((item) => item.isActive === 1)?.id ?? items[0]?.id ?? null)
      setBackups(backupItems)
    })
  }, [semesterId])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <span className="section-kicker">Dữ liệu và xuất bản</span>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Nhập, xuất thời khóa biểu</h2>
        <p className="mt-1 text-sm text-slate-500">Dùng mẫu Excel để nhập nhanh. Hệ thống chỉ ghi dữ liệu khi tệp không có lỗi.</p>
      </div>

      {error && <Alert>{error}</Alert>}
      {message && <Alert tone="info">{message}</Alert>}

      <div className="grid grid-cols-2 gap-4">
        <section className="card p-4">
          <h3 className="text-sm font-bold text-slate-900">1. Nhập dữ liệu từ Excel</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Hỗ trợ khối, lớp, môn, giáo viên, phòng học và phân công. Tên môn là định danh hiển thị; không cần mã môn.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              id="download-excel-template"
              className="btn-ghost"
              disabled={busy}
              onClick={() => run(async () => {
                const result = await call<{ filePath: string | null }>('spreadsheet:template')
                setMessage(result.filePath ? 'Đã lưu mẫu Excel.' : 'Đã hủy lưu mẫu Excel.')
              })}
            >
              Tải mẫu Excel
            </button>
            <button
              id="preview-excel-import"
              className="btn-primary"
              disabled={busy}
              onClick={() => run(async () => {
                const result = await call<ImportPreview | null>('spreadsheet:previewImport', { semesterId })
                if (result) setPreview(result)
              })}
            >
              Chọn tệp và kiểm tra
            </button>
          </div>
        </section>

        <section className="card p-4">
          <h3 className="text-sm font-bold text-slate-900">2. Xuất thời khóa biểu ra Excel</h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">Xuất toàn bộ tiết học của một phương án để tiếp tục tổng hợp hoặc chia sẻ.</p>
          {timetables.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">Chưa có phương án thời khóa biểu để xuất.</p>
          ) : (
            <div className="mt-4 flex gap-2">
              <select id="export-timetable-select" className="input" value={timetableId ?? ''} onChange={(event) => setTimetableId(Number(event.target.value))}>
                {timetables.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? ' (đang dùng)' : ''}</option>)}
              </select>
              <button
                id="export-timetable-excel"
                className="btn-primary shrink-0"
                disabled={busy || timetableId === null}
                onClick={() => run(async () => {
                  const result = await call<{ filePath: string | null }>('spreadsheet:exportTimetable', { timetableId })
                  setMessage(result.filePath ? 'Đã xuất thời khóa biểu ra Excel.' : 'Đã hủy xuất Excel.')
                })}
              >
                Xuất Excel
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="card p-4">
        <h3 className="text-sm font-bold text-slate-900">3. In hoặc xuất PDF</h3>
        <p className="mt-1 text-sm text-slate-500">Tạo biểu mẫu theo lớp, giáo viên hoặc toàn trường từ phương án đã chọn.</p>
        {timetables.length > 0 && (
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
            <select id="publication-scope" className="input" value={publicationScope} onChange={(event) => {
              const next = event.target.value as typeof publicationScope
              setPublicationScope(next)
              setPublicationTargetId(next === 'class' ? classes[0]?.id ?? null : next === 'teacher' ? teachers[0]?.id ?? null : null)
            }}>
              <option value="school">Toàn trường</option>
              <option value="class">Theo lớp</option>
              <option value="teacher">Theo giáo viên</option>
            </select>
            {publicationScope === 'class' ? (
              <select id="publication-class" className="input" value={publicationTargetId ?? ''} onChange={(event) => setPublicationTargetId(Number(event.target.value))}>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </select>
            ) : publicationScope === 'teacher' ? (
              <select id="publication-teacher" className="input" value={publicationTargetId ?? ''} onChange={(event) => setPublicationTargetId(Number(event.target.value))}>
                {teachers.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.fullName}</option>)}
              </select>
            ) : <div />}
            <div className="flex gap-2">
              <button id="print-timetable" className="btn-ghost" disabled={busy || timetableId === null || (publicationScope !== 'school' && !publicationTargetId)} onClick={() => run(async () => {
                await call('publication:print', { timetableId, scope: publicationScope, targetId: publicationTargetId })
                setMessage('Đã mở hộp thoại in.')
              })}>In</button>
              <button id="export-timetable-pdf" className="btn-primary" disabled={busy || timetableId === null || (publicationScope !== 'school' && !publicationTargetId)} onClick={() => run(async () => {
                const result = await call<{ filePath: string | null }>('publication:pdf', { timetableId, scope: publicationScope, targetId: publicationTargetId })
                setMessage(result.filePath ? 'Đã xuất thời khóa biểu ra PDF.' : 'Đã hủy xuất PDF.')
              })}>Xuất PDF</button>
            </div>
          </div>
        )}
      </section>

      <section className="card p-4">
        <h3 className="text-sm font-bold text-slate-900">4. Sao lưu và khôi phục</h3>
        <p className="mt-1 text-sm text-slate-500">Sao lưu tạo một tệp duy nhất. Khi khôi phục, hệ thống tự tạo bản sao hiện tại trước khi khởi động lại.</p>
        <div className="mt-4 flex gap-2">
          <button id="create-backup" className="btn-primary" disabled={busy} onClick={() => run(async () => {
            const result = await call<{ filePath: string | null }>('backup:create', { semesterId })
            if (result.filePath) {
              setBackups(await call<BackupRecord[]>('backup:list', { semesterId }))
              setMessage('Đã tạo bản sao lưu.')
            } else setMessage('Đã hủy sao lưu.')
          })}>Tạo bản sao lưu</button>
          <button id="restore-backup" className="btn-danger" disabled={busy} onClick={() => {
            if (!window.confirm('Khôi phục sẽ thay thế toàn bộ dữ liệu hiện tại và khởi động lại ứng dụng. Tiếp tục?')) return
            void run(async () => {
              const result = await call<{ restarting: boolean }>('backup:restore', { semesterId })
              if (result.restarting) setMessage('Đang khôi phục dữ liệu và khởi động lại ứng dụng.')
            })
          }}>Khôi phục từ tệp</button>
        </div>
        {backups.length > 0 && <p className="mt-3 text-xs text-slate-500">Bản gần nhất: {new Date(backups[0].createdAt).toLocaleString('vi-VN')}.</p>}
      </section>

      {preview && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Kiểm tra tệp: {preview.fileName}</h3>
              <p className="mt-0.5 text-xs text-slate-500">Dữ liệu sẽ được thêm mới hoặc cập nhật theo mã lớp, mã giáo viên, mã phòng và tên môn.</p>
            </div>
            <button
              id="apply-excel-import"
              className="btn-primary"
              disabled={busy || preview.errors.length > 0}
              onClick={() => run(async () => {
                const result = await call<{ counts: Record<string, number> }>('spreadsheet:applyImport', { semesterId, token: preview.token })
                setPreview(null)
                onChanged()
                setMessage(`Đã nhập ${Object.entries(result.counts).map(([name, count]) => `${count} ${name.toLowerCase()}`).join(', ')}.`)
              })}
            >
              Nhập dữ liệu
            </button>
          </div>
          {preview.errors.length > 0 ? (
            <div className="space-y-1.5 p-4">
              <Alert tone="warn">Tệp có {preview.errors.length} lỗi. Sửa tệp rồi chọn lại trước khi nhập.</Alert>
              {preview.errors.slice(0, 20).map((item, index) => <p key={index} className="text-sm text-slate-600">• {item}</p>)}
              {preview.errors.length > 20 && <p className="text-sm text-slate-500">… và {preview.errors.length - 20} lỗi khác.</p>}
            </div>
          ) : (
            <div className="p-4"><Alert tone="info">Tệp hợp lệ. Có thể nhập dữ liệu.</Alert></div>
          )}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-100 p-4">
            {preview.sheets.map((sheet) => (
              <div key={sheet.name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <strong className="text-sm text-slate-800">{sheet.name}</strong>
                <span className="mt-0.5 block text-xs text-slate-500">{sheet.count} dòng</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
