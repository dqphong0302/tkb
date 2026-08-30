import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { handle } from './util'
import { getContext } from './context'

interface JobState {
  status: 'running' | 'done' | 'error' | 'cancelled'
  semesterId: number
  baseTimetableId: number
  scopeClassIds: number[]
  proc: ChildProcessWithoutNullStreams | null
  lastSolution: { score: number; entries: SolverEntry[] } | null
  doneResult: DoneResult | null
  startedAt: number
}

interface SolverEntry {
  assignmentId: number
  classId: number
  subjectId: number
  teacherId: number | null
  roomId: number | null
  dayId: number
  periodId: number
}

interface DoneResult {
  status: string
  elapsedSeconds: number
  score: number | null
  initialScore?: number | null
  lnsUsed?: boolean
  lnsImproved?: boolean
  entries: SolverEntry[]
  missing: { assignmentId: number; classId: number; subjectId: number; missingCount: number }[]
}

const jobs = new Map<number, JobState>()

function broadcast(event: Record<string, unknown>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('solver:event', event)
  }
}

function pythonPath(): string {
  const root = app.getAppPath()
  const unix = join(root, 'solver', '.venv', 'bin', 'python3')
  const win = join(root, 'solver', '.venv', 'Scripts', 'python.exe')
  return process.platform === 'win32' && existsSync(win) ? win : unix
}

interface PreflightIssue {
  message: string
}

function runPreflight(semesterId: number, classIds: number[]): PreflightIssue[] {
  const issues: PreflightIssue[] = []
  const days = db()
    .select()
    .from(schema.teachingDay)
    .where(and(eq(schema.teachingDay.semesterId, semesterId), eq(schema.teachingDay.isActive, 1)))
    .all()
  const classes = db()
    .select()
    .from(schema.schoolClass)
    .where(and(eq(schema.schoolClass.semesterId, semesterId), inArray(schema.schoolClass.id, classIds)))
    .all()
  const assignments = db()
    .select()
    .from(schema.teachingAssignment)
    .where(and(eq(schema.teachingAssignment.semesterId, semesterId), inArray(schema.teachingAssignment.classId, classIds)))
    .all()
  const teachers = db().select().from(schema.teacher).where(eq(schema.teacher.semesterId, semesterId)).all()
  const subjects = db().select().from(schema.subject).where(eq(schema.subject.semesterId, semesterId)).all()
  const rooms = db().select().from(schema.room).where(eq(schema.room.semesterId, semesterId)).all()
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]))
  const busyByTeacher = db().select().from(schema.teacherAvailability).where(eq(schema.teacherAvailability.status, 'busy')).all()

  for (const a of assignments) {
    if (a.periodsPerWeek <= 0) issues.push({ message: `Phân công lớp/môn (id ${a.id}) có số tiết mỗi tuần bằng 0.` })
    if (!a.teacherId) issues.push({ message: `Phân công lớp/môn (id ${a.id}) chưa có giáo viên phụ trách.` })
    const subject = subjectById.get(a.subjectId)
    if (a.doubleRequired && a.doublePeriods <= 0) {
      issues.push({ message: `Phân công lớp/môn (id ${a.id}) yêu cầu tiết đôi nhưng chưa đặt số tiết đôi.` })
    }
    if (a.doublePeriods > 0 && subject?.allowDouble !== 1) {
      issues.push({ message: `Môn ${subject?.name ?? a.subjectId} chưa cho phép tiết đôi nhưng phân công có tiết đôi.` })
    }
    if (subject?.requiresSpecialRoom === 1 && !a.roomId && !subject.roomId) {
      issues.push({ message: `Môn ${subject.name} yêu cầu phòng chuyên môn nhưng chưa chọn phòng mặc định hoặc phòng trong phân công.` })
    }
  }

  for (const c of classes) {
    const total = assignments.filter((a) => a.classId === c.id).reduce((s, a) => s + a.periodsPerWeek, 0)
    const available = days.length * c.maxPeriodsPerDay
    if (total > available) {
      issues.push({
        message: `Lớp ${c.code}: tổng số tiết phân công (${total}) vượt số ô khả dụng của lớp (${available}).`
      })
    }
  }

  for (const t of teachers) {
    const own = assignments.filter((a) => a.teacherId === t.id)
    if (own.length === 0) continue
    const total = own.reduce((s, a) => s + a.periodsPerWeek, 0)
    const busyCount = busyByTeacher.filter((b) => b.teacherId === t.id).length
    const available = days.length * t.maxPeriodsPerDay - busyCount
    if (total > available) {
      issues.push({
        message: `Giáo viên ${t.code}: tổng số tiết phân công (${total}) vượt số ô mà giáo viên rảnh (${Math.max(available, 0)}).`
      })
    }
    for (const a of own) {
      if (a.periodsPerWeek > t.maxPeriodsPerDay * days.length) {
        issues.push({
          message: `Giáo viên ${t.code} không thể dạy đủ ${a.periodsPerWeek} tiết/tuần của một phân công với định mức ${t.maxPeriodsPerDay} tiết/ngày.`
        })
      }
    }
  }

  const specialRoomCount = rooms.filter((r) => r.kind === 'special').length
  const periodsCount = db().select().from(schema.period).where(eq(schema.period.semesterId, semesterId)).all().length
  const specialSubjectIds = new Set(subjects.filter((s) => s.requiresSpecialRoom === 1).map((s) => s.id))
  const specialNeeded = assignments
    .filter((a) => specialSubjectIds.has(a.subjectId))
    .reduce((s, a) => s + a.periodsPerWeek, 0)
  if (specialNeeded > 0) {
    const capacity = specialRoomCount * days.length * periodsCount
    if (specialRoomCount === 0) {
      issues.push({ message: 'Có môn yêu cầu phòng chuyên môn nhưng chưa khai báo phòng chuyên môn nào.' })
    } else if (specialNeeded > capacity) {
      issues.push({
        message: `Tổng số tiết cần phòng chuyên môn (${specialNeeded}) vượt sức chứa thời gian của nhóm phòng chuyên môn (${capacity}).`
      })
    }
  }

  for (const c of classes) {
    for (const a of assignments.filter((x) => x.classId === c.id)) {
      if (a.periodsPerWeek > c.maxPeriodsPerDay * days.length) {
        issues.push({
          message: `Lớp ${c.code} không thể xếp đủ ${a.periodsPerWeek} tiết/tuần của một môn với tối đa ${c.maxPeriodsPerDay} tiết/ngày.`
        })
      }
      const subject = subjects.find((s) => s.id === a.subjectId)
      if (subject && a.periodsPerWeek > subject.maxPerDay * days.length) {
        issues.push({
          message: `Môn ${subject.name} ở lớp ${c.code} yêu cầu ${a.periodsPerWeek} tiết/tuần nhưng tối đa ${subject.maxPerDay} tiết/ngày.`
        })
      }
    }
  }

  return issues
}

function classIdsForScope(semesterId: number, scope: { type: string; gradeIds?: number[]; classIds?: number[] }): number[] {
  const all = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.semesterId, semesterId)).all()
  if (scope.type === 'school') return all.map((c) => c.id)
  if (scope.type === 'grade') return all.filter((c) => scope.gradeIds?.includes(c.gradeId)).map((c) => c.id)
  if (scope.type === 'classes') return all.filter((c) => scope.classIds?.includes(c.id)).map((c) => c.id)
  return all.map((c) => c.id)
}

function buildSolverInput(params: {
  semesterId: number
  baseTimetableId: number
  scopeClassIds: number[]
  mode: 'full' | 'partial'
  timeLimitSeconds: number
  weights: Record<string, number>
}) {
  const { semesterId, baseTimetableId, scopeClassIds, mode, timeLimitSeconds, weights } = params
  const days = db()
    .select()
    .from(schema.teachingDay)
    .where(and(eq(schema.teachingDay.semesterId, semesterId), eq(schema.teachingDay.isActive, 1)))
    .all()
  const periods = db().select().from(schema.period).where(eq(schema.period.semesterId, semesterId)).all()
  const classesAll = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.semesterId, semesterId)).all()
  const scopeSet = new Set(scopeClassIds)
  const inScopeClasses = classesAll.filter((c) => scopeSet.has(c.id))
  const teachers = db().select().from(schema.teacher).where(eq(schema.teacher.semesterId, semesterId)).all()
  const subjects = db().select().from(schema.subject).where(eq(schema.subject.semesterId, semesterId)).all()
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const allAssignments = db()
    .select()
    .from(schema.teachingAssignment)
    .where(eq(schema.teachingAssignment.semesterId, semesterId))
    .all()
  const existingEntries = db()
    .select()
    .from(schema.timetableEntry)
    .where(eq(schema.timetableEntry.timetableId, baseTimetableId))
    .all()

  const fixedEntries = existingEntries.filter((e) => e.locked === 1 || !scopeSet.has(e.classId))
  const fixedByAssignment = new Map<number, number>()
  for (const e of fixedEntries) {
    if (e.assignmentId) fixedByAssignment.set(e.assignmentId, (fixedByAssignment.get(e.assignmentId) ?? 0) + 1)
  }

  const inScopeAssignments = allAssignments
    .filter((a) => scopeSet.has(a.classId) && a.teacherId)
    .filter((a) => a.periodsPerWeek - (fixedByAssignment.get(a.id) ?? 0) > 0)
    .map((a) => {
      const subject = subjectById.get(a.subjectId)
      return {
        id: a.id,
        classId: a.classId,
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        roomId: a.roomId ?? subject?.roomId ?? null,
        periodsPerWeek: a.periodsPerWeek,
        maxPerDay: subject?.maxPerDay ?? null,
        minGapDays: subject?.minGapDays ?? 0,
        allowDouble: subject?.allowDouble ?? 0,
        doublePeriods: a.doublePeriods,
        doubleRequired: a.doubleRequired
      }
    })

  const relevantTeacherIds = new Set(inScopeAssignments.map((a) => a.teacherId as number))
  const teacherAvail = db().select().from(schema.teacherAvailability).all()
  const classAvail = db()
    .select()
    .from(schema.classAvailability)
    .where(and(eq(schema.classAvailability.status, 'off'), inArray(schema.classAvailability.classId, [...scopeSet])))
    .all()
  const roomAvail = db()
    .select()
    .from(schema.roomAvailability)
    .where(eq(schema.roomAvailability.status, 'off'))
    .all()

  return {
    mode,
    timeLimitSeconds,
    days: days.map((d) => ({ id: d.id, weekday: d.weekday })),
    periods: periods.map((p) => ({ id: p.id, shift: p.shift, orderNo: p.orderNo })),
    classes: inScopeClasses.map((c) => ({ id: c.id, shift: c.shift, maxPeriodsPerDay: c.maxPeriodsPerDay })),
    teachers: teachers
      .filter((t) => relevantTeacherIds.has(t.id))
      .map((t) => ({ id: t.id, maxPeriodsPerDay: t.maxPeriodsPerDay })),
    assignments: inScopeAssignments,
    fixedEntries: fixedEntries.map((e) => ({
      classId: e.classId,
      teacherId: e.teacherId,
      roomId: e.roomId,
      dayId: e.dayId,
      periodId: e.periodId,
      assignmentId: e.assignmentId
    })),
    teacherBusy: teacherAvail
      .filter((t) => t.status === 'busy' && relevantTeacherIds.has(t.teacherId))
      .map((t) => ({ teacherId: t.teacherId, dayId: t.dayId, periodId: t.periodId })),
    teacherPrefer: teacherAvail
      .filter((t) => t.status === 'prefer' && relevantTeacherIds.has(t.teacherId))
      .map((t) => ({ teacherId: t.teacherId, dayId: t.dayId, periodId: t.periodId })),
    classAvailabilityOff: classAvail.map((c) => ({ classId: c.classId, dayId: c.dayId, periodId: c.periodId })),
    roomAvailabilityOff: roomAvail.map((r) => ({ roomId: r.roomId, dayId: r.dayId, periodId: r.periodId })),
    weights
  }
}

export function registerSolverHandlers(): void {
  handle('solver:preflight', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        scope: z.object({
          type: z.enum(['school', 'grade', 'classes']),
          gradeIds: z.array(z.number().int().positive()).optional(),
          classIds: z.array(z.number().int().positive()).optional()
        })
      })
      .parse(payload)
    const classIds = classIdsForScope(input.semesterId, input.scope)
    const issues = runPreflight(input.semesterId, classIds)
    return { ok: issues.length === 0, issues: issues.map((i) => i.message) }
  })

  handle('solver:start', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        timetableId: z.number().int().positive(),
        scope: z.object({
          type: z.enum(['school', 'grade', 'classes']),
          gradeIds: z.array(z.number().int().positive()).optional(),
          classIds: z.array(z.number().int().positive()).optional()
        }),
        mode: z.enum(['full', 'partial']).default('full'),
        timeLimitSeconds: z.number().int().min(10).max(600).default(120),
        weights: z
          .object({
            teacherGaps: z.number().int().min(0).max(3).default(0),
            subjectSpread: z.number().int().min(0).max(3).default(0),
            teacherPrefer: z.number().int().min(0).max(3).default(0),
            avoidSinglePeriod: z.number().int().min(0).max(3).default(0),
            softDoublePairs: z.number().int().min(0).max(3).default(0)
          })
          .default({})
      })
      .parse(payload)

    const ctx = getContext(input.semesterId)
    const scopeClassIds = classIdsForScope(input.semesterId, input.scope)
    const issues = runPreflight(input.semesterId, scopeClassIds)
    if (issues.length > 0) {
      throw new Error('Dữ liệu chưa đủ điều kiện xếp tự động:\n' + issues.map((i) => '- ' + i.message).join('\n'))
    }

    const jobRow = db()
      .insert(schema.solverJob)
      .values({
        schoolId: ctx.schoolId,
        semesterId: input.semesterId,
        status: 'running',
        scope: input.scope.type,
        mode: input.mode,
        startedAt: Date.now(),
        message: ''
      })
      .returning()
      .get()

    const solverInput = buildSolverInput({
      semesterId: input.semesterId,
      baseTimetableId: input.timetableId,
      scopeClassIds,
      mode: input.mode,
      timeLimitSeconds: input.timeLimitSeconds,
      weights: input.weights
    })

    const proc = spawn(pythonPath(), [join(app.getAppPath(), 'solver', 'tkb_solver.py')], {
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const state: JobState = {
      status: 'running',
      semesterId: input.semesterId,
      baseTimetableId: input.timetableId,
      scopeClassIds,
      proc,
      lastSolution: null,
      doneResult: null,
      startedAt: Date.now()
    }
    jobs.set(jobRow.id, state)

    let buffer = ''
    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const msg = JSON.parse(line)
          if (msg.type === 'solution') {
            state.lastSolution = { score: msg.score, entries: msg.entries }
          }
          if (msg.type === 'done') {
            state.doneResult = msg as DoneResult
            state.status = 'done'
            db()
              .update(schema.solverJob)
              .set({ status: 'done', finishedAt: Date.now(), message: msg.status })
              .where(eq(schema.solverJob.id, jobRow.id))
              .run()
          }
          if (msg.type === 'error') {
            state.status = 'error'
            db()
              .update(schema.solverJob)
              .set({ status: 'error', finishedAt: Date.now(), message: String(msg.message).slice(0, 500) })
              .where(eq(schema.solverJob.id, jobRow.id))
              .run()
          }
          broadcast({ jobId: jobRow.id, ...msg })
        } catch {
          // ignore malformed line
        }
      }
    })

    let stderrBuf = ''
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8')
    })

    proc.on('close', (code) => {
      if (state.status === 'running') {
        state.status = code === 0 ? 'done' : 'error'
        db()
          .update(schema.solverJob)
          .set({
            status: state.status,
            finishedAt: Date.now(),
            message: state.status === 'error' ? stderrBuf.slice(0, 500) || `exit code ${code}` : ''
          })
          .where(eq(schema.solverJob.id, jobRow.id))
          .run()
        broadcast({ jobId: jobRow.id, type: state.status === 'error' ? 'error' : 'done', message: stderrBuf.slice(0, 500) })
      }
    })

    proc.stdin.write(JSON.stringify(solverInput))
    proc.stdin.end()

    return { jobId: jobRow.id }
  })

  handle('solver:cancel', (payload) => {
    const { jobId } = z.object({ jobId: z.number().int().positive() }).parse(payload)
    const state = jobs.get(jobId)
    if (!state) throw new Error('Không tìm thấy tác vụ.')
    if (state.status === 'running' && state.proc) {
      state.proc.kill()
      state.status = 'cancelled'
      db()
        .update(schema.solverJob)
        .set({ status: 'cancelled', finishedAt: Date.now() })
        .where(eq(schema.solverJob.id, jobId))
        .run()
      broadcast({ jobId, type: 'cancelled' })
    }
    return { jobId }
  })

  handle('solver:job', (payload) => {
    const { jobId } = z.object({ jobId: z.number().int().positive() }).parse(payload)
    const row = db().select().from(schema.solverJob).where(eq(schema.solverJob.id, jobId)).get()
    if (!row) throw new Error('Không tìm thấy tác vụ.')
    const state = jobs.get(jobId)
    return {
      job: row,
      lastSolution: state?.lastSolution ?? null,
      doneResult: state?.doneResult ?? null
    }
  })

  handle('solver:jobs', (payload) => {
    const { semesterId } = z.object({ semesterId: z.number().int().positive() }).parse(payload)
    return db()
      .select()
      .from(schema.solverJob)
      .where(eq(schema.solverJob.semesterId, semesterId))
      .orderBy(schema.solverJob.id)
      .all()
      .reverse()
  })

  handle('solver:apply', (payload) => {
    const input = z
      .object({ jobId: z.number().int().positive(), name: z.string().trim().min(1, 'Tên phương án không được để trống') })
      .parse(payload)
    const state = jobs.get(input.jobId)
    const result = state?.doneResult ?? (state?.lastSolution ? { entries: state.lastSolution.entries } : null)
    if (!result || result.entries.length === 0) {
      throw new Error('Chưa có kết quả nào để áp dụng.')
    }
    const jobRow = db().select().from(schema.solverJob).where(eq(schema.solverJob.id, input.jobId)).get()
    if (!jobRow) throw new Error('Không tìm thấy tác vụ.')

    const baseEntries = db()
      .select()
      .from(schema.timetableEntry)
      .where(eq(schema.timetableEntry.timetableId, state!.baseTimetableId))
      .all()
    const scopeSet = new Set(state!.scopeClassIds)
    const keepEntries = baseEntries.filter((e) => e.locked === 1 || !scopeSet.has(e.classId))

    const newTimetable = db()
      .insert(schema.timetable)
      .values({
        schoolId: jobRow.schoolId,
        semesterId: jobRow.semesterId,
        name: input.name,
        isActive: 0,
        score: 'score' in result && typeof (result as DoneResult).score === 'number' ? (result as DoneResult).score! : 0,
        note: 'Tạo từ kết quả xếp tự động',
        createdAt: Date.now()
      })
      .returning()
      .get()

    for (const e of keepEntries) {
      db()
        .insert(schema.timetableEntry)
        .values({
          timetableId: newTimetable.id,
          classId: e.classId,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          roomId: e.roomId,
          dayId: e.dayId,
          periodId: e.periodId,
          assignmentId: e.assignmentId,
          locked: e.locked
        })
        .run()
    }
    for (const e of result.entries) {
      db()
        .insert(schema.timetableEntry)
        .values({
          timetableId: newTimetable.id,
          classId: e.classId,
          subjectId: e.subjectId,
          teacherId: e.teacherId,
          roomId: e.roomId,
          dayId: e.dayId,
          periodId: e.periodId,
          assignmentId: e.assignmentId,
          locked: 0
        })
        .run()
    }

    db()
      .update(schema.solverJob)
      .set({ resultTimetableId: newTimetable.id })
      .where(eq(schema.solverJob.id, input.jobId))
      .run()

    return newTimetable
  })

  handle('solver:discard', (payload) => {
    const { jobId } = z.object({ jobId: z.number().int().positive() }).parse(payload)
    jobs.delete(jobId)
    return { jobId }
  })
}
