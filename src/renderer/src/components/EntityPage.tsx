import { ReactNode, useMemo, useState } from 'react'
import { call } from '../lib/api'
import { useList } from '../lib/useList'
import { Modal, ConfirmButton } from './Modal'
import { Alert } from './Alert'

export type FieldType = 'text' | 'number' | 'select' | 'checkbox' | 'color'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: { value: string | number | null; label: string }[]
  defaultValue?: unknown
  hideInTable?: boolean
  hideInForm?: boolean
  format?: (row: any) => ReactNode
  min?: number
  max?: number
  nullable?: boolean
  autoGenerate?: boolean
}

interface Props {
  channel: string
  semesterId: number
  fields: FieldDef[]
  title: string
  description?: ReactNode
  emptyText?: string
  onChanged?: () => void
  extraActions?: ReactNode
  rowActions?: (row: any) => ReactNode
}

function emptyForm(fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    out[f.key] =
      f.defaultValue !== undefined
        ? f.defaultValue
        : f.type === 'number'
          ? 0
          : f.type === 'checkbox'
            ? 0
            : f.type === 'select'
              ? (f.options?.[0]?.value ?? null)
              : ''
  }
  return out
}

export function EntityPage({
  channel,
  semesterId,
  fields,
  title,
  description,
  emptyText,
  onChanged,
  extraActions,
  rowActions
}: Props) {
  const { items, error, reload } = useList<any>(`${channel}:list`, { semesterId })
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const columns = useMemo(() => fields.filter((f) => !f.hideInTable), [fields])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm(fields))
    setFormError(null)
    setDeleteError(null)
    setOpen(true)
  }

  function openEdit(row: any) {
    setEditing(row)
    const out: Record<string, unknown> = {}
    for (const f of fields) out[f.key] = row[f.key]
    setForm(out)
    setFormError(null)
    setDeleteError(null)
    setOpen(true)
  }

  async function save() {
    try {
      const payload: Record<string, unknown> = {}
      for (const f of fields) {
        if (f.hideInForm && !f.autoGenerate) continue
        let value = form[f.key]
        if (f.autoGenerate && (value === '' || value === null || value === undefined)) {
          value = `AUTO-${Date.now().toString(36).toUpperCase()}`
        }
        if (f.type === 'number') value = Number(value ?? 0)
        if (f.type === 'checkbox') value = value ? 1 : 0
        if (f.nullable && (value === '' || value === null || value === undefined)) value = null
        payload[f.key] = value
      }
      if (editing) {
        await call(`${channel}:update`, { id: editing.id, patch: payload })
      } else {
        await call(`${channel}:create`, { ...payload, semesterId })
      }
      setOpen(false)
      await reload()
      onChanged?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    }
  }

  async function remove(id: number) {
    try {
      setDeleteError(null)
      await call(`${channel}:delete`, { id })
      await reload()
      onChanged?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
        <div className="flex gap-2">
          {extraActions}
          <button className="btn-primary" onClick={openCreate}>
            + Thêm
          </button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}
      {deleteError && <Alert tone="warn">{deleteError}</Alert>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((f) => (
                <th key={f.key} className="th">
                  {f.label}
                </th>
              ))}
              <th className="th w-32 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className="td text-slate-400" colSpan={columns.length + 1}>
                  {emptyText ?? 'Chưa có dữ liệu.'}
                </td>
              </tr>
            )}
            {items.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((f) => (
                  <td key={f.key} className="td">
                    {f.format
                      ? f.format(row)
                      : f.type === 'checkbox'
                        ? row[f.key]
                          ? 'Có'
                          : '—'
                        : f.type === 'select'
                          ? (f.options?.find((o) => o.value === row[f.key])?.label ?? '—')
                          : f.type === 'color'
                            ? (
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className="inline-block h-3.5 w-3.5 rounded"
                                    style={{ background: String(row[f.key]) }}
                                  />
                                  {String(row[f.key])}
                                </span>
                              )
                            : String(row[f.key] ?? '')}
                  </td>
                ))}
                <td className="td text-right">
                  <div className="flex justify-end gap-1.5">
                    {rowActions?.(row)}
                    <button className="btn-ghost" onClick={() => openEdit(row)}>
                      Sửa
                    </button>
                    <ConfirmButton onConfirm={() => remove(row.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? `Sửa ${title.toLowerCase()}` : `Thêm ${title.toLowerCase()}`}
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
        <div className="space-y-3">
          {formError && <Alert>{formError}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            {fields
              .filter((f) => !f.hideInForm)
              .map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    className="input"
                    value={String(form[f.key] ?? '')}
                    onChange={(e) => {
                      const raw = e.target.value
                      const opt = f.options?.find((o) => String(o.value) === raw)
                      setForm({ ...form, [f.key]: opt ? opt.value : raw })
                    }}
                  >
                    {f.nullable && <option value="">— Không chọn —</option>}
                    {f.options?.map((o) => (
                      <option key={String(o.value)} value={String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.checked ? 1 : 0 })}
                  />
                ) : f.type === 'color' ? (
                  <input
                    type="color"
                    className="h-9 w-full rounded-md border border-slate-300"
                    value={String(form[f.key] ?? '#3b82f6')}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="input"
                    type={f.type === 'number' ? 'number' : 'text'}
                    min={f.min}
                    max={f.max}
                    value={String(form[f.key] ?? '')}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
