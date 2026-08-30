import { ReactNode, useEffect, useState } from 'react'

export function Modal({
  title,
  open,
  onClose,
  children,
  footer
}: {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl transition-all">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmButton({
  onConfirm,
  label = 'Xóa',
  title = 'Xác nhận xóa',
  message = 'Bạn chắc chắn muốn xóa mục này? Thao tác này không thể hoàn tác.',
  className = 'btn-danger'
}: {
  onConfirm: () => void | Promise<void>
  label?: string
  title?: string
  message?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal
        title={title}
        open={open}
        onClose={() => !busy && setOpen(false)}
        footer={
          <>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
            <button
              className="btn-danger !bg-red-600 !text-white hover:!bg-red-700"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await onConfirm()
                  setOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Đang xóa…' : 'Xác nhận xóa'}
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 py-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold">
            !
          </div>
          <div>
            <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
          </div>
        </div>
      </Modal>
    </>
  )
}
