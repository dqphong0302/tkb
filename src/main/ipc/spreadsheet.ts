import { dialog } from 'electron'
import { randomUUID } from 'crypto'
import * as XLSX from 'xlsx'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, raw, schema } from '../db'
import { handle, semesterScope } from './util'
import { getContext } from './context'

type SheetRow = Record<string, unknown>

interface ImportFile {
  fileName: string
  rows: Record<string, SheetRow[]>
  errors: string[]
}

const imports = new Map<string, ImportFile>()

const TEMPLATE_SHEETS: Record<string, string[]> = {
  'Khối': ['Tên khối', 'Thứ tự'],
  'Phòng học': ['Mã phòng', 'Tên phòng', 'Loại phòng', 'Sức chứa', 'Ghi chú'],
  'Lớp': ['Mã lớp', 'Tên lớp', 'Khối', 'Ca học', 'Tối đa tiết/ngày', 'Phòng cố định', 'Thứ tự'],
  'Môn học': ['Tên môn', 'Màu', 'Thứ tự', 'Cho phép tiết đôi', 'Tối đa/ngày', 'Giãn ngày', 'Cần phòng chuyên môn', 'Phòng mặc định'],
  'Giáo viên': ['Mã GV', 'Họ tên', 'Tên viết tắt', 'Tổ chuyên môn', 'Màu', 'Tối đa tiết/ngày', 'Hạn chế tiết trống', 'Ghi chú'],
  'Phân công': ['Mã lớp', 'Tên môn', 'Mã GV', 'Tiết/tuần', 'Số tiết đôi', 'Đôi bắt buộc', 'Phòng', 'Ghi chú']
}

function value(row: SheetRow, key: string): string {
  return String(row[key] ?? '').trim()
}

function intValue(row: SheetRow, key: string, fallback: number): number {
  const parsed = Number(value(row, key))
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function booleanValue(row: SheetRow, key: string): number {
  return /^(1|có|co|yes|true|x)$/i.test(value(row, key)) ? 1 : 0
}

function shiftValue(row: SheetRow): 'morning' | 'afternoon' | 'full' {
  const input = value(row, 'Ca học').toLowerCase()
  if (input === 'chiều' || input === 'chieu' || input === 'afternoon') return 'afternoon'
  if (input === 'cả ngày' || input === 'ca ngay' || input === 'full') return 'full'
  return 'morning'
}

function roomKind(row: SheetRow): 'normal' | 'special' {
  const input = value(row, 'Loại phòng').toLowerCase()
  return input === 'chuyên môn' || input === 'chuyen mon' || input === 'special' ? 'special' : 'normal'
}

function subjectCode(name: string, existing: Set<string>): string {
  const base = `MH-${name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .slice(0, 24) || 'MON'}`
  let code = base
  let index = 2
  while (existing.has(code)) code = `${base}-${index++}`
  existing.add(code)
  return code
}

function readWorkbook(filePath: string): ImportFile {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const rows: Record<string, SheetRow[]> = {}
  const errors: string[] = []
  for (const name of Object.keys(TEMPLATE_SHEETS)) {
    const sheet = workbook.Sheets[name]
    if (!sheet) continue
    rows[name] = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '', raw: false })
  }
  if (Object.keys(rows).length === 0) {
    errors.push(`Không tìm thấy trang hợp lệ. Dùng các tên trang: ${Object.keys(TEMPLATE_SHEETS).join(', ')}.`)
  }
  return { fileName: filePath.split(/[\\/]/).pop() ?? 'Dữ liệu Excel', rows, errors }
}

function validateRows(file: ImportFile, semesterId: number): string[] {
  const errors = [...file.errors]
  const dbGrades = db().select().from(schema.grade).where(eq(schema.grade.semesterId, semesterId)).all()
  const dbRooms = db().select().from(schema.room).where(eq(schema.room.semesterId, semesterId)).all()
  const dbClasses = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.semesterId, semesterId)).all()
  const dbSubjects = db().select().from(schema.subject).where(eq(schema.subject.semesterId, semesterId)).all()
  const dbTeachers = db().select().from(schema.teacher).where(eq(schema.teacher.semesterId, semesterId)).all()
  const grades = new Set([...dbGrades.map((x) => x.name), ...(file.rows['Khối'] ?? []).map((r) => value(r, 'Tên khối')).filter(Boolean)])
  const rooms = new Set([...dbRooms.map((x) => x.code), ...(file.rows['Phòng học'] ?? []).map((r) => value(r, 'Mã phòng')).filter(Boolean)])
  const classes = new Set([...dbClasses.map((x) => x.code), ...(file.rows['Lớp'] ?? []).map((r) => value(r, 'Mã lớp')).filter(Boolean)])
  const subjects = new Set([...dbSubjects.map((x) => x.name), ...(file.rows['Môn học'] ?? []).map((r) => value(r, 'Tên môn')).filter(Boolean)])
  const teachers = new Set([...dbTeachers.map((x) => x.code), ...(file.rows['Giáo viên'] ?? []).map((r) => value(r, 'Mã GV')).filter(Boolean)])

  for (const [sheet, rows] of Object.entries(file.rows)) {
    rows.forEach((row, index) => {
      const at = `${sheet}, dòng ${index + 2}`
      if (sheet === 'Khối' && !value(row, 'Tên khối')) errors.push(`${at}: thiếu Tên khối.`)
      if (sheet === 'Phòng học' && (!value(row, 'Mã phòng') || !value(row, 'Tên phòng'))) errors.push(`${at}: thiếu Mã phòng hoặc Tên phòng.`)
      if (sheet === 'Lớp') {
        if (!value(row, 'Mã lớp') || !value(row, 'Tên lớp')) errors.push(`${at}: thiếu Mã lớp hoặc Tên lớp.`)
        if (!grades.has(value(row, 'Khối'))) errors.push(`${at}: khối “${value(row, 'Khối')}” chưa tồn tại.`)
        if (value(row, 'Phòng cố định') && !rooms.has(value(row, 'Phòng cố định'))) errors.push(`${at}: phòng “${value(row, 'Phòng cố định')}” chưa tồn tại.`)
      }
      if (sheet === 'Môn học') {
        if (!value(row, 'Tên môn')) errors.push(`${at}: thiếu Tên môn.`)
        if (value(row, 'Phòng mặc định') && !rooms.has(value(row, 'Phòng mặc định'))) errors.push(`${at}: phòng “${value(row, 'Phòng mặc định')}” chưa tồn tại.`)
      }
      if (sheet === 'Giáo viên' && (!value(row, 'Mã GV') || !value(row, 'Họ tên'))) errors.push(`${at}: thiếu Mã GV hoặc Họ tên.`)
      if (sheet === 'Phân công') {
        if (!classes.has(value(row, 'Mã lớp'))) errors.push(`${at}: lớp “${value(row, 'Mã lớp')}” chưa tồn tại.`)
        if (!subjects.has(value(row, 'Tên môn'))) errors.push(`${at}: môn “${value(row, 'Tên môn')}” chưa tồn tại.`)
        if (value(row, 'Mã GV') && !teachers.has(value(row, 'Mã GV'))) errors.push(`${at}: giáo viên “${value(row, 'Mã GV')}” chưa tồn tại.`)
        if (value(row, 'Phòng') && !rooms.has(value(row, 'Phòng'))) errors.push(`${at}: phòng “${value(row, 'Phòng')}” chưa tồn tại.`)
        if (intValue(row, 'Tiết/tuần', 0) < 0) errors.push(`${at}: Tiết/tuần không hợp lệ.`)
      }
    })
  }
  return errors
}

function getId(statement: string, semesterId: number, key: string): number | null {
  const row = raw().prepare(statement).get(semesterId, key) as { id: number } | undefined
  return row?.id ?? null
}

function applyRows(file: ImportFile, semesterId: number): Record<string, number> {
  const context = getContext(semesterId)
  const database = raw()
  const counts: Record<string, number> = {}
  const existingCodes = new Set(
    (database.prepare('SELECT code FROM subject WHERE semester_id = ?').all(semesterId) as { code: string }[]).map((row) => row.code)
  )

  database.transaction(() => {
    for (const row of file.rows['Khối'] ?? []) {
      database.prepare(`INSERT INTO grade (school_id, semester_id, name, order_no) VALUES (?, ?, ?, ?)
        ON CONFLICT(semester_id, name) DO UPDATE SET order_no = excluded.order_no`).run(context.schoolId, semesterId, value(row, 'Tên khối'), intValue(row, 'Thứ tự', 0))
      counts['Khối'] = (counts['Khối'] ?? 0) + 1
    }
    for (const row of file.rows['Phòng học'] ?? []) {
      database.prepare(`INSERT INTO room (school_id, semester_id, code, name, kind, capacity, note) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(semester_id, code) DO UPDATE SET name = excluded.name, kind = excluded.kind, capacity = excluded.capacity, note = excluded.note`).run(
        context.schoolId, semesterId, value(row, 'Mã phòng'), value(row, 'Tên phòng'), roomKind(row), intValue(row, 'Sức chứa', 0), value(row, 'Ghi chú')
      )
      counts['Phòng học'] = (counts['Phòng học'] ?? 0) + 1
    }
    for (const row of file.rows['Lớp'] ?? []) {
      const gradeId = getId('SELECT id FROM grade WHERE semester_id = ? AND name = ?', semesterId, value(row, 'Khối'))!
      const roomId = value(row, 'Phòng cố định') ? getId('SELECT id FROM room WHERE semester_id = ? AND code = ?', semesterId, value(row, 'Phòng cố định')) : null
      database.prepare(`INSERT INTO school_class (school_id, semester_id, grade_id, code, name, shift, max_periods_per_day, room_id, order_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(semester_id, code) DO UPDATE SET grade_id = excluded.grade_id, name = excluded.name, shift = excluded.shift, max_periods_per_day = excluded.max_periods_per_day, room_id = excluded.room_id, order_no = excluded.order_no`).run(
        context.schoolId, semesterId, gradeId, value(row, 'Mã lớp'), value(row, 'Tên lớp'), shiftValue(row), intValue(row, 'Tối đa tiết/ngày', 5), roomId, intValue(row, 'Thứ tự', 0)
      )
      counts['Lớp'] = (counts['Lớp'] ?? 0) + 1
    }
    for (const row of file.rows['Môn học'] ?? []) {
      const name = value(row, 'Tên môn')
      const existing = database.prepare('SELECT id FROM subject WHERE semester_id = ? AND name = ?').get(semesterId, name) as { id: number } | undefined
      const roomId = value(row, 'Phòng mặc định') ? getId('SELECT id FROM room WHERE semester_id = ? AND code = ?', semesterId, value(row, 'Phòng mặc định')) : null
      if (existing) {
        database.prepare('UPDATE subject SET color = ?, order_no = ?, allow_double = ?, max_per_day = ?, min_gap_days = ?, requires_special_room = ?, room_id = ? WHERE id = ?').run(
          value(row, 'Màu') || '#3b82f6', intValue(row, 'Thứ tự', 0), booleanValue(row, 'Cho phép tiết đôi'), intValue(row, 'Tối đa/ngày', 2), intValue(row, 'Giãn ngày', 0), booleanValue(row, 'Cần phòng chuyên môn'), roomId, existing.id
        )
      } else {
        database.prepare('INSERT INTO subject (school_id, semester_id, code, name, color, order_no, allow_double, max_per_day, min_gap_days, requires_special_room, room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
          context.schoolId, semesterId, subjectCode(name, existingCodes), name, value(row, 'Màu') || '#3b82f6', intValue(row, 'Thứ tự', 0), booleanValue(row, 'Cho phép tiết đôi'), intValue(row, 'Tối đa/ngày', 2), intValue(row, 'Giãn ngày', 0), booleanValue(row, 'Cần phòng chuyên môn'), roomId
        )
      }
      counts['Môn học'] = (counts['Môn học'] ?? 0) + 1
    }
    for (const row of file.rows['Giáo viên'] ?? []) {
      database.prepare(`INSERT INTO teacher (school_id, semester_id, code, full_name, short_name, department, color, max_periods_per_day, avoid_gaps, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(semester_id, code) DO UPDATE SET full_name = excluded.full_name, short_name = excluded.short_name, department = excluded.department, color = excluded.color, max_periods_per_day = excluded.max_periods_per_day, avoid_gaps = excluded.avoid_gaps, note = excluded.note`).run(
        context.schoolId, semesterId, value(row, 'Mã GV'), value(row, 'Họ tên'), value(row, 'Tên viết tắt'), value(row, 'Tổ chuyên môn'), value(row, 'Màu') || '#10b981', intValue(row, 'Tối đa tiết/ngày', 5), booleanValue(row, 'Hạn chế tiết trống'), value(row, 'Ghi chú')
      )
      counts['Giáo viên'] = (counts['Giáo viên'] ?? 0) + 1
    }
    for (const row of file.rows['Phân công'] ?? []) {
      const classId = getId('SELECT id FROM school_class WHERE semester_id = ? AND code = ?', semesterId, value(row, 'Mã lớp'))!
      const subjectId = getId('SELECT id FROM subject WHERE semester_id = ? AND name = ?', semesterId, value(row, 'Tên môn'))!
      const teacherId = value(row, 'Mã GV') ? getId('SELECT id FROM teacher WHERE semester_id = ? AND code = ?', semesterId, value(row, 'Mã GV')) : null
      const roomId = value(row, 'Phòng') ? getId('SELECT id FROM room WHERE semester_id = ? AND code = ?', semesterId, value(row, 'Phòng')) : null
      database.prepare(`INSERT INTO teaching_assignment (school_id, semester_id, class_id, subject_id, teacher_id, periods_per_week, double_periods, double_required, room_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(semester_id, class_id, subject_id) DO UPDATE SET teacher_id = excluded.teacher_id, periods_per_week = excluded.periods_per_week, double_periods = excluded.double_periods, double_required = excluded.double_required, room_id = excluded.room_id, note = excluded.note`).run(
        context.schoolId, semesterId, classId, subjectId, teacherId, intValue(row, 'Tiết/tuần', 0), intValue(row, 'Số tiết đôi', 0), booleanValue(row, 'Đôi bắt buộc'), roomId, value(row, 'Ghi chú')
      )
      counts['Phân công'] = (counts['Phân công'] ?? 0) + 1
    }
  })()
  return counts
}

function saveWorkbook(workbook: XLSX.WorkBook, defaultPath: string): string | null {
  const filePath = dialog.showSaveDialogSync({ defaultPath, filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
  if (!filePath) return null
  XLSX.writeFile(workbook, filePath, { bookType: 'xlsx' })
  return filePath
}

export function registerSpreadsheetHandlers(): void {
  handle('spreadsheet:template', () => {
    const workbook = XLSX.utils.book_new()
    for (const [name, headers] of Object.entries(TEMPLATE_SHEETS)) {
      const sheet = XLSX.utils.aoa_to_sheet([headers])
      sheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 4, 16) }))
      XLSX.utils.book_append_sheet(workbook, sheet, name)
    }
    return { filePath: saveWorkbook(workbook, 'mau-nhap-thoi-khoa-bieu.xlsx') }
  })

  handle('spreadsheet:previewImport', (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    const filePath = dialog.showOpenDialogSync({ properties: ['openFile'], filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }] })?.[0]
    if (!filePath) return null
    const file = readWorkbook(filePath)
    const errors = validateRows(file, semesterId)
    const token = randomUUID()
    imports.set(token, { ...file, errors })
    return {
      token,
      fileName: file.fileName,
      errors,
      sheets: Object.entries(file.rows).map(([name, rows]) => ({ name, count: rows.length, sample: rows.slice(0, 3) }))
    }
  })

  handle('spreadsheet:applyImport', (payload) => {
    const input = z.object({ semesterId: z.number().int().positive(), token: z.string().uuid() }).parse(payload)
    const file = imports.get(input.token)
    if (!file) throw new Error('Bản xem trước đã hết hạn. Hãy chọn lại tệp Excel.')
    const errors = validateRows(file, input.semesterId)
    if (errors.length > 0) throw new Error(`Tệp còn ${errors.length} lỗi, chưa thể nhập.`)
    const counts = applyRows(file, input.semesterId)
    imports.delete(input.token)
    return { counts }
  })

  handle('spreadsheet:exportTimetable', (payload) => {
    const { timetableId } = z.object({ timetableId: z.number().int().positive() }).parse(payload)
    const timetable = db().select().from(schema.timetable).where(eq(schema.timetable.id, timetableId)).get()
    if (!timetable) throw new Error('Không tìm thấy phương án thời khóa biểu.')
    const classes = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.semesterId, timetable.semesterId)).all()
    const teachers = db().select().from(schema.teacher).where(eq(schema.teacher.semesterId, timetable.semesterId)).all()
    const subjects = db().select().from(schema.subject).where(eq(schema.subject.semesterId, timetable.semesterId)).all()
    const rooms = db().select().from(schema.room).where(eq(schema.room.semesterId, timetable.semesterId)).all()
    const days = db().select().from(schema.teachingDay).where(eq(schema.teachingDay.semesterId, timetable.semesterId)).orderBy(asc(schema.teachingDay.weekday)).all()
    const periods = db().select().from(schema.period).where(eq(schema.period.semesterId, timetable.semesterId)).orderBy(asc(schema.period.shift), asc(schema.period.orderNo)).all()
    const entries = db().select().from(schema.timetableEntry).where(eq(schema.timetableEntry.timetableId, timetableId)).all()
    const byId = <T extends { id: number }>(items: T[]) => new Map(items.map((item) => [item.id, item]))
    const classById = byId(classes); const teacherById = byId(teachers); const subjectById = byId(subjects); const roomById = byId(rooms)
    const rows = entries.map((entry) => ({
      'Lớp': classById.get(entry.classId)?.code ?? '',
      'Giáo viên': entry.teacherId ? `${teacherById.get(entry.teacherId)?.code ?? ''} - ${teacherById.get(entry.teacherId)?.fullName ?? ''}` : '',
      'Môn': subjectById.get(entry.subjectId)?.name ?? '',
      'Phòng': entry.roomId ? roomById.get(entry.roomId)?.code ?? '' : '',
      'Ngày': days.find((day) => day.id === entry.dayId)?.name ?? '',
      'Tiết': periods.find((period) => period.id === entry.periodId)?.name ?? '',
      'Giờ': (() => { const p = periods.find((period) => period.id === entry.periodId); return p ? `${p.startTime}-${p.endTime}` : '' })(),
      'Đã khóa': entry.locked ? 'Có' : ''
    }))
    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.json_to_sheet(rows)
    sheet['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(workbook, sheet, 'Thời khóa biểu')
    return { filePath: saveWorkbook(workbook, `${timetable.name.replace(/[^\p{L}\p{N}]+/gu, '-') || 'thoi-khoa-bieu'}.xlsx`) }
  })
}
