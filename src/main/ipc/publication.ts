import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle } from './util'

type Scope = 'school' | 'class' | 'teacher'

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function scheduleHtml(timetableId: number, scope: Scope, targetId: number | null): { html: string; fileName: string } {
  const timetable = db().select().from(schema.timetable).where(eq(schema.timetable.id, timetableId)).get()
  if (!timetable) throw new Error('Không tìm thấy phương án thời khóa biểu.')
  const semester = db().select().from(schema.semester).where(eq(schema.semester.id, timetable.semesterId)).get()
  const school = semester ? db().select().from(schema.school).where(eq(schema.school.id, semester.schoolId)).get() : null
  const classes = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.semesterId, timetable.semesterId)).all()
  const teachers = db().select().from(schema.teacher).where(eq(schema.teacher.semesterId, timetable.semesterId)).all()
  const subjects = db().select().from(schema.subject).where(eq(schema.subject.semesterId, timetable.semesterId)).all()
  const rooms = db().select().from(schema.room).where(eq(schema.room.semesterId, timetable.semesterId)).all()
  const days = db().select().from(schema.teachingDay).where(eq(schema.teachingDay.semesterId, timetable.semesterId)).orderBy(asc(schema.teachingDay.weekday)).all()
  const periods = db().select().from(schema.period).where(eq(schema.period.semesterId, timetable.semesterId)).orderBy(asc(schema.period.shift), asc(schema.period.orderNo)).all()
  const entries = db().select().from(schema.timetableEntry).where(eq(schema.timetableEntry.timetableId, timetableId)).all()
  const classById = new Map(classes.map((item) => [item.id, item]))
  const teacherById = new Map(teachers.map((item) => [item.id, item]))
  const subjectById = new Map(subjects.map((item) => [item.id, item]))
  const roomById = new Map(rooms.map((item) => [item.id, item]))

  const isClass = scope === 'class'
  const isTeacher = scope === 'teacher'
  if ((isClass || isTeacher) && !targetId) throw new Error('Chưa chọn đối tượng cần in.')
  const target = isClass ? classById.get(targetId!) : isTeacher ? teacherById.get(targetId!) : null
  if ((isClass || isTeacher) && !target) throw new Error('Không tìm thấy đối tượng cần in.')
  const selectedEntries = entries.filter((entry) => scope === 'school' || (isClass ? entry.classId === targetId : entry.teacherId === targetId))
  const title = scope === 'school' ? 'Thời khóa biểu toàn trường' : `Thời khóa biểu ${isClass ? `lớp ${(target as typeof classes[number]).code}` : `giáo viên ${(target as typeof teachers[number]).fullName}`}`

  const body = scope === 'school'
    ? `<table><thead><tr><th>Lớp</th><th>Giáo viên</th><th>Môn</th><th>Phòng</th><th>Ngày</th><th>Tiết</th></tr></thead><tbody>${selectedEntries
      .sort((a, b) => a.dayId - b.dayId || a.periodId - b.periodId || a.classId - b.classId)
      .map((entry) => `<tr><td>${escapeHtml(classById.get(entry.classId)?.code ?? '')}</td><td>${escapeHtml(entry.teacherId ? teacherById.get(entry.teacherId)?.fullName ?? '' : '')}</td><td>${escapeHtml(subjectById.get(entry.subjectId)?.name ?? '')}</td><td>${escapeHtml(entry.roomId ? roomById.get(entry.roomId)?.code ?? '' : '')}</td><td>${escapeHtml(days.find((day) => day.id === entry.dayId)?.name ?? '')}</td><td>${escapeHtml(periods.find((period) => period.id === entry.periodId)?.name ?? '')}</td></tr>`)
      .join('')}</tbody></table>`
    : `<table class="grid"><thead><tr><th>Tiết</th>${days.map((day) => `<th>${escapeHtml(day.name)}</th>`).join('')}</tr></thead><tbody>${periods.map((period) => `<tr><th>${escapeHtml(period.name)}<small>${escapeHtml(period.startTime)} - ${escapeHtml(period.endTime)}</small></th>${days.map((day) => {
      const entry = selectedEntries.find((item) => item.dayId === day.id && item.periodId === period.id)
      if (!entry) return '<td></td>'
      const primary = subjectById.get(entry.subjectId)?.name ?? ''
      const secondary = isClass ? teacherById.get(entry.teacherId ?? 0)?.shortName || teacherById.get(entry.teacherId ?? 0)?.code || '' : classById.get(entry.classId)?.code ?? ''
      const room = entry.roomId ? roomById.get(entry.roomId)?.code ?? '' : ''
      return `<td><strong>${escapeHtml(primary)}</strong><span>${escapeHtml(secondary)}</span>${room ? `<small>${escapeHtml(room)}</small>` : ''}</td>`
    }).join('')}</tr>`).join('')}</tbody></table>`

  return {
    fileName: `${scope === 'school' ? 'thoi-khoa-bieu-toan-truong' : isClass ? `thoi-khoa-bieu-lop-${(target as typeof classes[number]).code}` : `thoi-khoa-bieu-giao-vien-${(target as typeof teachers[number]).code}`}.pdf`,
    html: `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; } body { color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 10px; }
      header { border-bottom: 2px solid #1d4ed8; display: flex; justify-content: space-between; margin-bottom: 14px; padding-bottom: 8px; } h1 { font-size: 18px; margin: 2px 0; } p { color: #475569; margin: 3px 0; }
      table { border-collapse: collapse; width: 100%; } th { background: #eff6ff; color: #1e3a8a; font-weight: 700; } th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; } .grid td { height: 58px; width: 14%; } .grid strong, .grid span, .grid small { display: block; } .grid span { color: #475569; margin-top: 3px; } small { color: #64748b; font-size: 8px; font-weight: 400; }
      footer { color: #64748b; font-size: 8px; margin-top: 10px; text-align: right; }
    </style></head><body><header><div><p>${escapeHtml(school?.name ?? '')}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(semester?.name ?? '')} - ${escapeHtml(timetable.name)}</p></div><p>Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p></header>${body}<footer>Phần mềm Thời khóa biểu</footer></body></html>`
  }
}

async function withDocument(html: string, action: (window: BrowserWindow) => Promise<void>): Promise<void> {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await action(window)
  } finally {
    if (!window.isDestroyed()) window.destroy()
  }
}

export function registerPublicationHandlers(): void {
  const inputSchema = z.object({ timetableId: z.number().int().positive(), scope: z.enum(['school', 'class', 'teacher']), targetId: z.number().int().positive().nullable().optional() })

  handle('publication:pdf', async (payload) => {
    const input = inputSchema.parse(payload)
    const document = scheduleHtml(input.timetableId, input.scope, input.targetId ?? null)
    const filePath = dialog.showSaveDialogSync({ defaultPath: document.fileName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (!filePath) return { filePath: null }
    await withDocument(document.html, async (window) => {
      const pdf = await window.webContents.printToPDF({ pageSize: 'A4', landscape: true, printBackground: true })
      await writeFile(filePath, pdf)
    })
    return { filePath }
  })

  handle('publication:print', async (payload) => {
    const input = inputSchema.parse(payload)
    const document = scheduleHtml(input.timetableId, input.scope, input.targetId ?? null)
    await withDocument(document.html, (window) => new Promise((resolve, reject) => {
      window.webContents.print({ silent: false, printBackground: true }, (success, reason) => success ? resolve() : reject(new Error(reason || 'Không thể mở hộp thoại in.')))
    }))
    return { ok: true }
  })
}
