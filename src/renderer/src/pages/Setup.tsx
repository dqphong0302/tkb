import { useState } from 'react'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'

export function SetupPage({ onDone }: { onDone: () => void }) {
  const year = new Date().getFullYear()
  const [schoolName, setSchoolName] = useState('')
  const [yearName, setYearName] = useState(`${year}–${year + 1}`)
  const [semesterName, setSemesterName] = useState('Học kỳ 1')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      await call('app:setup', { schoolName, yearName, semesterName })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-lg font-semibold">Khởi tạo dữ liệu</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nhập thông tin trường và học kỳ đầu tiên. Toàn bộ dữ liệu được lưu trên máy này.
        </p>
        <div className="mt-5 space-y-3">
          {error && <Alert>{error}</Alert>}
          <div>
            <label className="label">Tên trường</label>
            <input
              className="input"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Trường THCS ..."
            />
          </div>
          <div>
            <label className="label">Năm học</label>
            <input className="input" value={yearName} onChange={(e) => setYearName(e.target.value)} />
          </div>
          <div>
            <label className="label">Học kỳ</label>
            <input
              className="input"
              value={semesterName}
              onChange={(e) => setSemesterName(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full justify-center" disabled={busy} onClick={submit}>
            Bắt đầu
          </button>
        </div>
      </div>
    </div>
  )
}
