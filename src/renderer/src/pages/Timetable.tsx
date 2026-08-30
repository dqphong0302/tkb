import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Grade,
  Period,
  Room,
  SchoolClass,
  Subject,
  Teacher,
  TeachingDay,
  Timetable,
  TimetableEntry,
  TimetableProgress,
  TeacherAvailability
} from '@shared/types'
import { SHIFT_LABEL } from '@shared/constants'
import { call } from '../lib/api'
import { Alert } from '../components/Alert'
import { Modal, ConfirmButton } from '../components/Modal'
import { AutoSolvePage, type AutoSolveRequest, type AutoSolveScope } from './AutoSolve'

type ViewMode = 'class' | 'teacher' | 'matrix'

interface HistoryAction {
  label: string
  do: () => Promise<void>
  undo: () => Promise<void>
  redo: () => Promise<void>
}

const HISTORY_LIMIT = 50

export function TimetablePage({ semesterId }: { semesterId: number }) {
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [autoRequest, setAutoRequest] = useState<AutoSolveRequest | null>(null)
  const [timetables, setTimetables] = useState<Timetable[]>([])
  const [timetableId, setTimetableId] = useState<number | null>(null)
  const [entries, setEntries] = useState<TimetableEntry[]>([])
  const [progress, setProgress] = useState<TimetableProgress | null>(null)

  const [grades, setGrades] = useState<Grade[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [days, setDays] = useState<TeachingDay[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [teacherBusy, setTeacherBusy] = useState<TeacherAvailability[]>([])

  const [mode, setMode] = useState<ViewMode>('class')
  const [schoolDisplay, setSchoolDisplay] = useState<'stack' | 'matrix'>('stack')
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  // Interactive state
  const [activeBrushAssignmentId, setActiveBrushAssignmentId] = useState<number | null>(null)
  const [showCompletedSubjects, setShowCompletedSubjects] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailEntry, setDetailEntry] = useState<TimetableEntry | null>(null)
  const [pickerCell, setPickerCell] = useState<{ dayId: number; periodId: number } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{ dayId: number; periodId: number; classId?: number } | null>(null)

  // Plan Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneName, setCloneName] = useState('')

  const undoStack = useRef<HistoryAction[]>([])
  const redoStack = useRef<HistoryAction[]>([])
  const [, forceRerender] = useState(0)

  const loadStatics = useCallback(async () => {
    const [g, c, t, s, r, d, p, tb] = await Promise.all([
      call<Grade[]>('grade:list', { semesterId }),
      call<SchoolClass[]>('class:list', { semesterId }),
      call<Teacher[]>('teacher:list', { semesterId }),
      call<Subject[]>('subject:list', { semesterId }),
      call<Room[]>('room:list', { semesterId }),
      call<TeachingDay[]>('day:list', { semesterId }),
      call<Period[]>('period:list', { semesterId }),
      call<TeacherAvailability[]>('teacherAvailability:list', { semesterId }).catch(() => [])
    ])
    setGrades(g)
    setClasses(c)
    setTeachers(t)
    setSubjects(s)
    setRooms(r)
    setDays(d)
    setPeriods(p)
    setTeacherBusy(tb.filter((x) => x.status === 'busy'))
  }, [semesterId])

  const loadTimetables = useCallback(async () => {
    const list = await call<Timetable[]>('timetable:list', { semesterId })
    setTimetables(list)
    if (list.length > 0) {
      const active = list.find((t) => t.isActive === 1) ?? list[0]
      setTimetableId((cur) => (cur && list.some((t) => t.id === cur) ? cur : active.id))
    } else {
      setTimetableId(null)
    }
  }, [semesterId])

  const loadGrid = useCallback(async () => {
    if (!timetableId) return
    const [e, prog] = await Promise.all([
      call<TimetableEntry[]>('timetable:entries', { timetableId }),
      call<TimetableProgress>('timetable:progress', { timetableId })
    ])
    setEntries(e)
    setProgress(prog)
  }, [timetableId])

  useEffect(() => {
    void loadStatics()
    void loadTimetables()
  }, [loadStatics, loadTimetables])

  useEffect(() => {
    void loadGrid()
  }, [loadGrid])

  useEffect(() => {
    undoStack.current = []
    redoStack.current = []
    setActiveBrushAssignmentId(null)
    forceRerender((v) => v + 1)
  }, [timetableId])

  useEffect(() => {
    if (mode === 'matrix') return
    const list = mode === 'class'
      ? (selectedGradeId === null ? classes : classes.filter((c) => c.gradeId === selectedGradeId))
      : teachers
    if (list.length > 0 && (!selectedId || !list.some((x) => x.id === selectedId))) {
      setSelectedId(list[0].id)
    }
  }, [mode, selectedGradeId, classes, teachers, selectedId])

  const activeDays = useMemo(
    () => days.filter((d) => d.isActive === 1).sort((a, b) => a.weekday - b.weekday),
    [days]
  )

  const selectedClass = mode === 'class' ? classes.find((c) => c.id === selectedId) : null
  const selectedTeacher = mode === 'teacher' ? teachers.find((t) => t.id === selectedId) : null

  const gridPeriods = useMemo(() => {
    const sorted = [...periods].sort((a, b) => {
      if (a.shift !== b.shift) return a.shift === 'morning' ? -1 : 1
      return a.orderNo - b.orderNo
    })
    if (mode === 'class' && selectedClass && selectedClass.shift !== 'full') {
      return sorted.filter((p) => p.shift === selectedClass.shift)
    }
    return sorted
  }, [periods, mode, selectedClass])

  const entriesForSelected = useMemo(() => {
    if (selectedId === null || mode === 'matrix') return []
    return entries.filter((e) => (mode === 'class' ? e.classId === selectedId : e.teacherId === selectedId))
  }, [entries, mode, selectedId])

  const entryByClassSlot = useMemo(() => {
    const map = new Map<string, TimetableEntry>()
    for (const entry of entries) map.set(`${entry.classId}-${entry.dayId}-${entry.periodId}`, entry)
    return map
  }, [entries])

  const schoolClasses = useMemo(
    () => (selectedGradeId === null ? classes : classes.filter((c) => c.gradeId === selectedGradeId)),
    [classes, selectedGradeId]
  )

  const lockedCount = useMemo(() => entries.filter((e) => e.locked === 1).length, [entries])

  function entryAt(dayId: number, periodId: number): TimetableEntry | undefined {
    return entriesForSelected.find((e) => e.dayId === dayId && e.periodId === periodId)
  }

  const progressForSelected = useMemo(() => {
    if (!progress || selectedId === null || mode === 'matrix') return []
    return progress.items.filter(
      (i) => mode === 'class' ? i.classId === selectedId : i.teacherId === selectedId
    )
  }, [progress, mode, selectedId])

  const remainingForSelected = useMemo(
    () => progressForSelected.filter((item) => item.placed < item.required),
    [progressForSelected]
  )

  const paletteItems = useMemo(
    () => (showCompletedSubjects ? progressForSelected : remainingForSelected),
    [showCompletedSubjects, progressForSelected, remainingForSelected]
  )

  const missingPeriodsForSelected = useMemo(
    () => remainingForSelected.reduce((sum, item) => sum + Math.max(0, item.required - item.placed), 0),
    [remainingForSelected]
  )

  const missingSubjectCountForSelected = remainingForSelected.length
  const requiredForSelected = progressForSelected.reduce((sum, item) => sum + item.required, 0)
  const placedForSelected = progressForSelected.reduce((sum, item) => sum + item.placed, 0)
  const remainingAcrossSchool = useMemo(
    () => progress?.items.filter((item) => item.placed < item.required) ?? [],
    [progress]
  )
  const missingPeriodsAcrossSchool = remainingAcrossSchool.reduce(
    (sum, item) => sum + Math.max(0, item.required - item.placed),
    0
  )

  // Conflict Scanner (Real-time detection)
  const conflicts = useMemo(() => {
    const issues: { message: string; entryIds: number[]; dayId: number; periodId: number }[] = []
    const slotMap = new Map<string, TimetableEntry[]>()

    for (const e of entries) {
      const key = `${e.dayId}-${e.periodId}`
      const list = slotMap.get(key) ?? []
      list.push(e)
      slotMap.set(key, list)
    }

    for (const [key, slotEntries] of slotMap.entries()) {
      const [dIdStr, pIdStr] = key.split('-')
      const dId = Number(dIdStr)
      const pId = Number(pIdStr)

      // Teacher collision
      const teacherGroups = new Map<number, TimetableEntry[]>()
      for (const e of slotEntries) {
        if (!e.teacherId) continue
        const list = teacherGroups.get(e.teacherId) ?? []
        list.push(e)
        teacherGroups.set(e.teacherId, list)
      }
      for (const [tId, grp] of teacherGroups.entries()) {
        if (grp.length > 1) {
          const tName = teachers.find((t) => t.id === tId)?.fullName ?? `GV #${tId}`
          issues.push({
            message: `Trùng giáo viên: ${tName} đang dạy ${grp.length} lớp cùng lúc`,
            entryIds: grp.map((x) => x.id),
            dayId: dId,
            periodId: pId
          })
        }
      }

      // Room collision
      const roomGroups = new Map<number, TimetableEntry[]>()
      for (const e of slotEntries) {
        if (!e.roomId) continue
        const list = roomGroups.get(e.roomId) ?? []
        list.push(e)
        roomGroups.set(e.roomId, list)
      }
      for (const [rId, grp] of roomGroups.entries()) {
        if (grp.length > 1) {
          const rName = rooms.find((r) => r.id === rId)?.name ?? `Phòng #${rId}`
          issues.push({
            message: `Trùng phòng: ${rName} được xếp cho ${grp.length} lớp cùng lúc`,
            entryIds: grp.map((x) => x.id),
            dayId: dId,
            periodId: pId
          })
        }
      }

      // Teacher busy collision
      for (const e of slotEntries) {
        if (!e.teacherId) continue
        const isBusy = teacherBusy.some(
          (b) => b.teacherId === e.teacherId && b.dayId === dId && b.periodId === pId
        )
        if (isBusy) {
          const tName = teachers.find((t) => t.id === e.teacherId)?.fullName ?? `GV #${e.teacherId}`
          issues.push({
            message: `Vi phạm lịch bận: ${tName} đang bị xếp vào giờ bận`,
            entryIds: [e.id],
            dayId: dId,
            periodId: pId
          })
        }
      }
    }

    return issues
  }, [entries, teachers, rooms, teacherBusy])

  const conflictSlotKeys = useMemo(() => {
    return new Set(conflicts.map((c) => `${c.dayId}-${c.periodId}`))
  }, [conflicts])

  // Search and filter lists
  const filteredBrowserItems = useMemo(() => {
    let list: (SchoolClass | Teacher)[] = []
    if (mode === 'class') {
      list = selectedGradeId === null ? classes : classes.filter((c) => c.gradeId === selectedGradeId)
    } else {
      list = teachers
    }
    const term = search.trim().toLowerCase()
    if (term) {
      list = list.filter((x: any) =>
        mode === 'class'
          ? x.code.toLowerCase().includes(term) || x.name.toLowerCase().includes(term)
          : x.code.toLowerCase().includes(term) || x.fullName.toLowerCase().includes(term)
      )
    }
    return list.map((item: any) => {
      const own = progress?.items.filter((i) => (mode === 'class' ? i.classId === item.id : i.teacherId === item.id)) ?? []
      const placed = own.reduce((s, i) => s + i.placed, 0)
      const required = own.reduce((s, i) => s + i.required, 0)
      return { item, placed, required }
    })
  }, [mode, selectedGradeId, classes, teachers, search, progress])

  function subjectOf(id: number) {
    return subjects.find((s) => s.id === id)
  }
  function classOf(id: number) {
    return classes.find((c) => c.id === id)
  }
  function teacherOf(id: number | null) {
    return id ? teachers.find((t) => t.id === id) : undefined
  }
  function roomOf(id: number | null) {
    return id ? rooms.find((r) => r.id === id) : undefined
  }

  // History & actions
  const perform = useCallback(async (action: HistoryAction) => {
    try {
      await action.do()
      undoStack.current.push(action)
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
      redoStack.current = []
      setError(null)
      await loadGrid()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    forceRerender((v) => v + 1)
  }, [loadGrid])

  const undo = useCallback(async () => {
    const action = undoStack.current.pop()
    if (!action || !timetableId) return
    try {
      await action.undo()
      redoStack.current.push(action)
      setError(null)
      await loadGrid()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    forceRerender((v) => v + 1)
  }, [timetableId, loadGrid])

  const redo = useCallback(async () => {
    const action = redoStack.current.pop()
    if (!action || !timetableId) return
    try {
      await action.redo()
      undoStack.current.push(action)
      setError(null)
      await loadGrid()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    forceRerender((v) => v + 1)
  }, [timetableId, loadGrid])

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const isCmdOrCtrl = e.metaKey || e.ctrlKey

      if (isCmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        void undo()
      } else if (
        (isCmdOrCtrl && e.key.toLowerCase() === 'y') ||
        (isCmdOrCtrl && e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault()
        void redo()
      } else if (e.key === 'Escape') {
        setActiveBrushAssignmentId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  function placeAction(assignmentId: number, dayId: number, periodId: number): HistoryAction {
    const handle = { id: 0 }
    return {
      label: 'Xếp tiết',
      async do() {
        const entry = await call<TimetableEntry>('timetable:place', {
          timetableId,
          assignmentId,
          dayId,
          periodId
        })
        handle.id = entry.id
      },
      async undo() {
        await call('timetable:remove', { id: handle.id })
      },
      async redo() {
        const entry = await call<TimetableEntry>('timetable:place', {
          timetableId,
          assignmentId,
          dayId,
          periodId
        })
        handle.id = entry.id
      }
    }
  }

  function moveAction(entry: TimetableEntry, toDayId: number, toPeriodId: number): HistoryAction {
    const fromDayId = entry.dayId
    const fromPeriodId = entry.periodId
    return {
      label: 'Di chuyển tiết',
      async do() {
        await call('timetable:move', { entryId: entry.id, dayId: toDayId, periodId: toPeriodId })
      },
      async undo() {
        await call('timetable:move', { entryId: entry.id, dayId: fromDayId, periodId: fromPeriodId })
      },
      async redo() {
        await call('timetable:move', { entryId: entry.id, dayId: toDayId, periodId: toPeriodId })
      }
    }
  }

  function swapAction(entryId1: number, entryId2: number): HistoryAction {
    return {
      label: 'Đổi chỗ tiết',
      async do() {
        await call('timetable:swap', { entryId1, entryId2 })
      },
      async undo() {
        await call('timetable:swap', { entryId1, entryId2 })
      },
      async redo() {
        await call('timetable:swap', { entryId1, entryId2 })
      }
    }
  }

  function removeAction(entry: TimetableEntry): HistoryAction {
    const handle = { id: entry.id }
    return {
      label: 'Xóa tiết',
      async do() {
        await call('timetable:remove', { id: handle.id })
      },
      async undo() {
        const created = await call<TimetableEntry>('timetable:place', {
          timetableId,
          assignmentId: entry.assignmentId,
          dayId: entry.dayId,
          periodId: entry.periodId
        })
        handle.id = created.id
        if (entry.locked) await call('timetable:toggleLock', { id: created.id })
      },
      async redo() {
        await call('timetable:remove', { id: handle.id })
      }
    }
  }

  function toggleLockAction(entryId: number): HistoryAction {
    return {
      label: 'Khóa/mở khóa tiết',
      async do() {
        await call('timetable:toggleLock', { id: entryId })
      },
      async undo() {
        await call('timetable:toggleLock', { id: entryId })
      },
      async redo() {
        await call('timetable:toggleLock', { id: entryId })
      }
    }
  }

  // Drag & Drop Handlers
  function onDragStartEntry(e: React.DragEvent, entry: TimetableEntry) {
    if (entry.locked) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'entry', entryId: entry.id }))
  }

  function onDragStartUnplaced(e: React.DragEvent, assignmentId: number) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'unplaced', assignmentId }))
  }

  function onCellDrop(e: React.DragEvent, dayId: number, periodId: number, targetClassId?: number) {
    e.preventDefault()
    setDragOverCell(null)
    const raw = e.dataTransfer.getData('text/plain')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      if (data.type === 'unplaced' && data.assignmentId) {
        const item = progress?.items.find((candidate) => candidate.assignmentId === data.assignmentId)
        if (targetClassId !== undefined && item && item.classId !== targetClassId) {
          setError('Thẻ môn này thuộc lớp khác. Hãy thả vào đúng dòng của lớp.')
          return
        }
        void perform(placeAction(data.assignmentId, dayId, periodId))
      } else if (data.type === 'entry' && data.entryId) {
        const dragged = entries.find((x) => x.id === data.entryId)
        if (!dragged) return
        const target = targetClassId !== undefined
          ? entries.find((entry) => entry.classId === targetClassId && entry.dayId === dayId && entry.periodId === periodId)
          : entryAt(dayId, periodId)
        if (target && target.id === dragged.id) return
        if (target) {
          if (target.locked) {
            setError('Không thể đổi chỗ với tiết đã khóa.')
            return
          }
          void perform(swapAction(dragged.id, target.id))
        } else {
          void perform(moveAction(dragged, dayId, periodId))
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  function handleSlotClick(dId: number, pId: number) {
    if (activeBrushAssignmentId) {
      void perform(placeAction(activeBrushAssignmentId, dId, pId))
    } else {
      setPickerCell({ dayId: dId, periodId: pId })
    }
  }

  function handleMatrixSlotClick(classId: number, dayId: number, periodId: number) {
    if (activeBrushAssignmentId) {
      const item = progress?.items.find((candidate) => candidate.assignmentId === activeBrushAssignmentId)
      if (item && item.classId === classId) {
        void perform(placeAction(activeBrushAssignmentId, dayId, periodId))
      } else {
        setError('Môn đang chọn thuộc lớp khác. Hãy chọn đúng dòng lớp trên ma trận.')
      }
      return
    }
    setSelectedId(classId)
    setMode('class')
  }

  // Plan Handlers
  async function createTimetable() {
    if (!newName.trim()) return
    try {
      const created = await call<Timetable>('timetable:create', { semesterId, name: newName.trim() })
      setNewName('')
      setCreateOpen(false)
      await loadTimetables()
      setTimetableId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function cloneTimetable() {
    if (!timetableId || !cloneName.trim()) return
    try {
      const cloned = await call<Timetable>('timetable:clone', { id: timetableId, name: cloneName.trim() })
      setCloneName('')
      setCloneOpen(false)
      await loadTimetables()
      setTimetableId(cloned.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function deleteTimetable() {
    if (!timetableId) return
    try {
      await call('timetable:delete', { id: timetableId })
      await loadTimetables()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function clearCurrentClassUnlocked() {
    if (!timetableId || !selectedClass) return
    try {
      await call('timetable:clearScope', { timetableId, classId: selectedClass.id })
      await loadGrid()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function lockCurrentClass(locked: number) {
    if (!timetableId || !selectedClass) return
    try {
      await call('timetable:lockScope', { timetableId, classId: selectedClass.id, locked })
      await loadGrid()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function openAuto(scopeType: AutoSolveScope, targetClassId?: number) {
    const request: AutoSolveRequest = { timetableId, scopeType }
    const targetClass = targetClassId ? classes.find((item) => item.id === targetClassId) : selectedClass
    if (scopeType === 'classes' && targetClass) request.classIds = [targetClass.id]
    if (scopeType === 'grade' && targetClass) request.gradeIds = [targetClass.gradeId]
    setAutoRequest(request)
    setAutoModalOpen(true)
  }

  const currentPlan = timetables.find((t) => t.id === timetableId)

  // Empty state when no timetable plans exist
  if (timetables.length === 0) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="card p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600">
            📅
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Bắt đầu Phương án Thời Khóa Biểu</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chưa có phương án thời khóa biểu nào cho học kỳ này. Hãy tạo phương án đầu tiên để bắt đầu xếp lịch.
            </p>
          </div>
          <div className="mx-auto flex max-w-md items-center gap-2 pt-2">
            <input
              className="input"
              placeholder="Tên phương án, ví dụ: Phương án 1 (Chính thức)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTimetable()}
            />
            <button className="btn-primary shrink-0" onClick={createTimetable}>
              + Tạo phương án
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-3">
      {/* 1. TOP COMMAND BAR */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        {/* Left: Plan Selector & Plan Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-500">Phương án:</label>
            <select
              id="timetable-plan"
              className="input w-60 font-semibold"
              value={timetableId ?? ''}
              onChange={(e) => setTimetableId(Number(e.target.value))}
            >
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.isActive ? '★ (Đang dùng)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="btn-ghost px-2.5 py-1.5 text-xs font-semibold"
              onClick={() => setCreateOpen(true)}
              title="Tạo phương án thời khóa biểu mới"
            >
              + Mới
            </button>
            <button
              className="btn-ghost px-2.5 py-1.5 text-xs font-semibold"
              onClick={() => {
                setCloneName(`${currentPlan?.name ?? 'Phương án'} (Bản sao)`)
                setCloneOpen(true)
              }}
              title="Nhân bản phương án hiện tại để thử nghiệm xếp lịch khác"
            >
              📋 Nhân bản
            </button>
            {currentPlan && currentPlan.isActive !== 1 && (
              <button
                className="btn-ghost px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                onClick={async () => {
                  await call('timetable:activate', { id: currentPlan.id })
                  await loadTimetables()
                }}
                title="Đặt phương án này làm thời khóa biểu chính thức của trường"
              >
                ✓ Kích hoạt
              </button>
            )}
            {timetables.length > 1 && currentPlan && (
              <ConfirmButton
                label="Xóa"
                message={`Xóa phương án "${currentPlan.name}"? Thao tác này không thể hoàn tác.`}
                onConfirm={deleteTimetable}
              />
            )}
          </div>
        </div>

        {/* Center: View Switcher Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              mode === 'class' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setMode('class')}
          >
            🏫 Theo Lớp
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              mode === 'teacher' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setMode('teacher')}
          >
            👨‍🏫 Theo Giáo viên
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              mode === 'matrix' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => setMode('matrix')}
          >
            📊 Ma trận Toàn trường
          </button>
        </div>

        {/* Right: Quick Auto & Undo/Redo & Shortcuts */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200"
            title="Các tiết có biểu tượng khóa sẽ được giữ nguyên tuyệt đối khi xếp tự động"
          >
            🔒 {lockedCount} đã khóa
          </span>

          <button
            className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs font-bold shadow-sm"
            onClick={() => openAuto(selectedClass ? 'classes' : 'school')}
          >
            ⚡ Tự động xếp
          </button>

          <div className="flex items-center border-l border-slate-200 pl-2">
            <button
              className="btn-ghost px-2 py-1.5 text-xs font-semibold"
              disabled={undoStack.current.length === 0}
              onClick={undo}
              title="Hoàn tác (Cmd+Z / Ctrl+Z)"
            >
              ↶ <span className="kbd ml-1">⌘Z</span>
            </button>
            <button
              className="btn-ghost px-2 py-1.5 text-xs font-semibold"
              disabled={redoStack.current.length === 0}
              onClick={redo}
              title="Làm lại (Cmd+Shift+Z / Ctrl+Y)"
            >
              ↷ <span className="kbd ml-1">⌘⇧Z</span>
            </button>
          </div>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && <Alert>{error}</Alert>}

      {/* Conflict Warning Banner (if any) */}
      {conflicts.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 shadow-sm">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 font-bold text-white text-[10px]">
              !
            </span>
            <span>
              Phát hiện <strong>{conflicts.length} xung đột lịch</strong> trong phương án này: {conflicts[0].message}
              {conflicts.length > 1 ? ` (và ${conflicts.length - 1} xung đột khác)` : ''}.
            </span>
          </div>
        </div>
      )}

      {progress && mode !== 'matrix' && (
        <section className="remaining-strip" aria-label="Tiến độ xếp môn">
          <div className="remaining-strip-title">
            <span className="section-kicker">Tiến độ lớp / giáo viên</span>
            <strong>{placedForSelected}/{requiredForSelected} tiết đã xếp</strong>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="rounded-full bg-rose-50 px-2.5 py-1 font-bold text-rose-700">
              Thiếu {missingPeriodsForSelected} tiết
            </span>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-700">
              {missingSubjectCountForSelected} môn chưa đủ
            </span>
          </div>
          <div className="remaining-subjects" aria-label="Các môn còn thiếu">
            {remainingForSelected.length === 0 ? (
              <span className="all-done">✓ Đã đủ tất cả môn cho đối tượng đang chọn</span>
            ) : (
              remainingForSelected.map((item) => {
                const subject = subjectOf(item.subjectId)
                const countLeft = Math.max(0, item.required - item.placed)
                return (
                  <button
                    id={`missing-subject-${item.assignmentId}`}
                    key={item.assignmentId}
                    type="button"
                    className="subject-chip hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => setActiveBrushAssignmentId(item.assignmentId)}
                    title="Bấm để chọn môn, sau đó bấm các ô trống để xếp nhanh"
                  >
                    <i style={{ backgroundColor: subject?.color ?? '#2563eb' }} />
                    <span>{subject?.name ?? 'Chưa đặt tên môn'}</span>
                    <b>còn {countLeft}</b>
                  </button>
                )
              })
            )}
          </div>
          <span className="drag-hint hidden lg:inline">Kéo thẻ môn ở khay dưới vào lưới</span>
        </section>
      )}

      {/* 2. MAIN WORKBENCH LAYOUT */}
      {mode === 'matrix' ? (
        /* MASTER MULTI-CLASS MATRIX VIEW */
        <div className="card flex-1 flex flex-col p-4 space-y-3 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {schoolDisplay === 'stack' ? 'Xếp thời khóa biểu Toàn trường' : 'Ma trận Thời khóa biểu Toàn trường'}
              </h3>
              <p className="text-xs text-slate-500">
                {schoolDisplay === 'stack'
                  ? 'Mỗi lớp có một khung lịch và khay môn riêng; kéo thẻ môn vào ô trống để xếp nhanh.'
                  : 'Hiển thị toàn cảnh lịch dạy của tất cả các lớp trong tuần. Nhấp vào lớp bất kỳ để chỉnh sửa chi tiết.'}
              </p>
            </div>
            {/* Grade filter tabs in Matrix */}
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                <button
                  id="school-display-stack"
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                    schoolDisplay === 'stack' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => setSchoolDisplay('stack')}
                >
                  Theo lớp + môn
                </button>
                <button
                  id="school-display-matrix"
                  type="button"
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                    schoolDisplay === 'matrix' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  onClick={() => setSchoolDisplay('matrix')}
                >
                  Ma trận
                </button>
              </div>
              <span className="text-xs font-bold text-slate-500">Lọc khối:</span>
              <button
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  selectedGradeId === null ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                onClick={() => setSelectedGradeId(null)}
              >
                Tất cả ({classes.length})
              </button>
              {grades.map((g) => (
                <button
                  key={g.id}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    selectedGradeId === g.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  onClick={() => setSelectedGradeId(g.id)}
                >
                  {g.name} ({classes.filter((c) => c.gradeId === g.id).length})
                </button>
              ))}
            </div>
          </div>

          {schoolDisplay === 'stack' ? (
            <div className="school-stack flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
              {schoolClasses.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  Chưa có lớp trong phạm vi đang chọn.
                </div>
              )}
              {schoolClasses.map((c) => {
                const classPeriods = c.shift === 'full' ? gridPeriods : gridPeriods.filter((period) => period.shift === c.shift)
                const classProgress = progress?.items.filter((item) => item.classId === c.id) ?? []
                const classRemaining = classProgress.filter((item) => item.placed < item.required)
                const classPalette = showCompletedSubjects ? classProgress : classRemaining
                const classRequired = classProgress.reduce((sum, item) => sum + item.required, 0)
                const classPlaced = classProgress.reduce((sum, item) => sum + item.placed, 0)
                const classMissing = classRemaining.reduce((sum, item) => sum + Math.max(0, item.required - item.placed), 0)

                return (
                  <article key={c.id} className="school-class-card">
                    <div className="school-class-head">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="section-kicker">Lớp</span>
                        <strong className="text-base text-slate-900">{c.code}</strong>
                        <span className="truncate text-xs text-slate-500">{c.name}</span>
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          Ca {SHIFT_LABEL[c.shift].toLowerCase()}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-1 font-bold ${classMissing ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {classMissing ? `Thiếu ${classMissing} tiết` : 'Đã đủ'}
                        </span>
                        <span className="text-slate-500">{classPlaced}/{classRequired} tiết</span>
                        <button
                          id={`school-edit-class-${c.id}`}
                          type="button"
                          className="btn-ghost px-2 py-1 text-[11px]"
                          onClick={() => {
                            setSelectedId(c.id)
                            setMode('class')
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          id={`school-auto-class-${c.id}`}
                          type="button"
                          className="btn-primary px-2 py-1 text-[11px]"
                          onClick={() => openAuto('classes', c.id)}
                        >
                          ⚡ Auto
                        </button>
                      </div>
                    </div>

                    <div className="schedule-grid-wrap school-class-grid">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="th w-24">Tiết / Ca</th>
                            {activeDays.map((day) => (
                              <th key={day.id} className="schedule-day-head">{day.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {classPeriods.map((period) => (
                            <tr key={period.id}>
                              <td className="schedule-period-head">
                                <strong>{period.name}</strong>
                                <span className="text-[10px] text-slate-400">{period.startTime}–{period.endTime}</span>
                              </td>
                              {activeDays.map((day) => {
                                const entry = entryByClassSlot.get(`${c.id}-${day.id}-${period.id}`)
                                const isDragOver = dragOverCell?.classId === c.id && dragOverCell.dayId === day.id && dragOverCell.periodId === period.id
                                const subject = entry ? subjectOf(entry.subjectId) : null
                                const teacher = entry ? teacherOf(entry.teacherId) : null
                                return (
                                  <td
                                    key={day.id}
                                    className={`schedule-cell ${isDragOver ? 'schedule-cell-dragover' : ''}`}
                                    onClick={() => handleMatrixSlotClick(c.id, day.id, period.id)}
                                    onDragOver={(event) => {
                                      event.preventDefault()
                                      setDragOverCell({ dayId: day.id, periodId: period.id, classId: c.id })
                                    }}
                                    onDragLeave={() => setDragOverCell(null)}
                                    onDrop={(event) => onCellDrop(event, day.id, period.id, c.id)}
                                  >
                                    {entry ? (
                                      <div
                                        draggable={!entry.locked}
                                        onDragStart={(event) => onDragStartEntry(event, entry)}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setDetailEntry(entry)
                                        }}
                                        onContextMenu={(event) => {
                                          event.preventDefault()
                                          event.stopPropagation()
                                          void perform(toggleLockAction(entry.id))
                                        }}
                                        className={`schedule-entry ${entry.locked ? 'schedule-entry-locked' : ''}`}
                                        style={{
                                          backgroundColor: `${subject?.color ?? '#3b82f6'}1a`,
                                          borderLeftColor: subject?.color ?? '#3b82f6'
                                        }}
                                        title={entry.locked ? 'Tiết đã khóa' : 'Kéo để di chuyển · Chuột phải để khóa'}
                                      >
                                        <div className="flex items-center justify-between gap-1 font-bold text-slate-900">
                                          <span className="truncate">{subject?.name ?? '—'}</span>
                                          {entry.locked === 1 && <span className="text-[11px]">🔒</span>}
                                        </div>
                                        <span className="truncate text-[11px] text-slate-600">{teacher?.shortName || teacher?.code || '—'}</span>
                                      </div>
                                    ) : (
                                      <button
                                        id={`school-empty-slot-${c.id}-${day.id}-${period.id}`}
                                        type="button"
                                        className={`empty-slot ${activeBrushAssignmentId ? 'border-blue-400 bg-blue-50/50 text-blue-600' : ''}`}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          handleMatrixSlotClick(c.id, day.id, period.id)
                                        }}
                                        title={activeBrushAssignmentId ? 'Xếp môn đang chọn vào ô này' : 'Chọn lớp để xếp môn'}
                                      >
                                        +
                                      </button>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="unplaced-palette school-class-palette">
                      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-800">Môn của lớp {c.code}</span>
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">{classMissing} tiết thiếu</span>
                        </div>
                        <span className="text-[11px] text-slate-400">Kéo thẻ vào lưới · bấm để xếp liên tiếp</span>
                      </div>
                      {classPalette.length === 0 ? (
                        <div className="all-done">✓ Lớp này chưa có môn cần xếp</div>
                      ) : (
                        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                          {classPalette.map((item) => {
                            const subject = subjectOf(item.subjectId)
                            const teacher = teacherOf(item.teacherId)
                            const countLeft = Math.max(0, item.required - item.placed)
                            const isComplete = countLeft === 0
                            const isBrushActive = activeBrushAssignmentId === item.assignmentId
                            return (
                              <div
                                key={item.assignmentId}
                                draggable={!isComplete}
                                onDragStart={(event) => {
                                  if (!isComplete) onDragStartUnplaced(event, item.assignmentId)
                                }}
                                onClick={() => {
                                  if (!isComplete) setActiveBrushAssignmentId(isBrushActive ? null : item.assignmentId)
                                }}
                                className={`palette-card ${isBrushActive ? 'palette-card-active' : ''} ${isComplete ? 'palette-card-complete' : ''}`}
                                style={{ borderLeftColor: subject?.color ?? '#2563eb', borderLeftWidth: '4px' }}
                                title={isComplete ? 'Môn này đã xếp đủ' : 'Kéo vào lưới hoặc bấm để chọn xếp liên tiếp'}
                              >
                                <div className="flex min-w-0 items-start gap-1.5">
                                  <span className="mt-0.5 shrink-0 text-sm leading-none text-slate-400" aria-hidden="true">⠿</span>
                                  <div className="min-w-0">
                                    <strong className="block truncate text-xs text-slate-900">{subject?.name ?? 'Chưa đặt tên môn'}</strong>
                                    <span className="block truncate text-[10px] text-slate-500">{teacher?.shortName || teacher?.code || 'Chưa gán GV'}</span>
                                  </div>
                                </div>
                                <span className={`palette-count-badge ${isComplete ? 'palette-count-complete' : ''}`}>
                                  {isComplete ? `✓ Đã xếp ${item.placed}` : `${item.placed}/${item.required} · còn ${countLeft}`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <>
          <div className="matrix-wrap flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th th-sticky w-24">Lớp</th>
                  {activeDays.map((d) => (
                    <th
                      key={d.id}
                      colSpan={gridPeriods.length}
                      className="border-b border-l border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-700"
                    >
                      {d.name}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="th th-sticky text-xs">Ca / Tiết</th>
                  {activeDays.map((d) =>
                    gridPeriods.map((p) => (
                      <th
                        key={`${d.id}-${p.id}`}
                        className="border-b border-r border-slate-200 bg-slate-50 px-1 py-1 text-center text-[10px] font-semibold text-slate-500"
                      >
                        {p.shift === 'morning' ? 'S' : 'C'}{p.orderNo}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {(selectedGradeId === null ? classes : classes.filter((c) => c.gradeId === selectedGradeId)).map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="th-sticky border-b border-r border-slate-200 px-2.5 py-1.5">
                        <button
                          className="text-left font-bold text-blue-600 hover:underline"
                          onClick={() => {
                            setSelectedId(c.id)
                            setMode('class')
                          }}
                        >
                          {c.code}
                        </button>
                        <div className="text-[10px] text-slate-400">{SHIFT_LABEL[c.shift]}</div>
                      </td>
                      {activeDays.map((d) =>
                        gridPeriods.map((p) => {
                          const entry = entryByClassSlot.get(`${c.id}-${d.id}-${p.id}`)
                          const isConflict = entry && conflictSlotKeys.has(`${d.id}-${p.id}`)
                          const isDragOver = dragOverCell?.classId === c.id && dragOverCell.dayId === d.id && dragOverCell.periodId === p.id
                          const subj = entry ? subjectOf(entry.subjectId) : null
                          const teacher = entry ? teacherOf(entry.teacherId) : null
                          return (
                            <td
                              key={`${d.id}-${p.id}`}
                              className={`matrix-cell ${isConflict ? 'bg-rose-50' : ''} ${isDragOver ? 'matrix-cell-dragover' : ''}`}
                              onClick={() => handleMatrixSlotClick(c.id, d.id, p.id)}
                              onDragOver={(e) => {
                                e.preventDefault()
                                if (dragOverCell?.classId !== c.id || dragOverCell.dayId !== d.id || dragOverCell.periodId !== p.id) {
                                  setDragOverCell({ dayId: d.id, periodId: p.id, classId: c.id })
                                }
                              }}
                              onDragLeave={() => setDragOverCell(null)}
                              onDrop={(e) => onCellDrop(e, d.id, p.id, c.id)}
                            >
                              {entry && (
                                <div
                                  className="matrix-entry-pill"
                                  style={{
                                    backgroundColor: `${subj?.color ?? '#3b82f6'}1a`,
                                    borderLeftColor: subj?.color ?? '#3b82f6'
                                  }}
                                  title={`${subj?.name ?? ''} — GV: ${teacher?.fullName ?? ''}${entry.locked ? ' (Đã khóa)' : ''}`}
                                >
                                  <span className="truncate">{subj?.name}</span>
                                  <span className="truncate text-[9px] text-slate-500">
                                    {teacher?.shortName || teacher?.code || ''}
                                  </span>
                                </div>
                              )}
                            </td>
                          )
                        })
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="unplaced-palette">
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-800">Môn còn thiếu toàn trường</span>
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                  {missingPeriodsAcrossSchool} tiết thiếu · {remainingAcrossSchool.length} môn
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Kéo vào đúng ô của lớp hoặc bấm thẻ để mở lịch lớp</span>
            </div>
            {remainingAcrossSchool.length === 0 ? (
              <div className="all-done">✓ Toàn trường đã xếp đủ tất cả tiết</div>
            ) : (
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                {remainingAcrossSchool.map((item) => {
                  const subject = subjectOf(item.subjectId)
                  const cls = classOf(item.classId)
                  const teacher = teacherOf(item.teacherId)
                  const countLeft = Math.max(0, item.required - item.placed)
                  return (
                    <button
                      id={`school-missing-subject-${item.assignmentId}`}
                      key={item.assignmentId}
                      type="button"
                      draggable
                      onDragStart={(event) => onDragStartUnplaced(event, item.assignmentId)}
                      onClick={() => {
                        setSelectedId(item.classId)
                        setMode('class')
                        setActiveBrushAssignmentId(item.assignmentId)
                      }}
                      className="palette-card"
                      style={{ borderLeftColor: subject?.color ?? '#2563eb', borderLeftWidth: '4px' }}
                      title="Kéo vào ô của đúng lớp hoặc bấm để mở lịch lớp"
                    >
                      <span className="min-w-0 text-left">
                        <strong className="block truncate text-xs text-slate-900">{subject?.name ?? 'Chưa đặt tên môn'}</strong>
                        <span className="block truncate text-[10px] text-slate-500">
                          Lớp {cls?.code ?? `#${item.classId}`} · {teacher?.shortName || teacher?.code || 'Chưa gán GV'}
                        </span>
                      </span>
                      <span className="palette-count-badge">còn {countLeft}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
            </>
          )}
        </div>
      ) : (
        /* SINGLE VIEW WORKBENCH (CLASS OR TEACHER VIEW) */
        <div className="flex flex-1 gap-3 min-h-0">
          {/* LEFT: ENTITY BROWSER WITH GRADE TABS */}
          <aside className="schedule-browser flex flex-col shadow-sm">
            {/* Mode Header */}
            <div className="schedule-browser-head bg-slate-50/60 p-3">
              <span className="section-kicker">Danh mục</span>
              <h2 className="text-sm font-bold text-slate-900">
                {mode === 'class' ? 'Danh sách Lớp học' : 'Danh sách Giáo viên'}
              </h2>
            </div>

            {/* Grade filter tabs (only in class mode) */}
            {mode === 'class' && (
              <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/40 p-1.5">
                <button
                  className={`rounded-md px-2 py-1 text-[11px] font-bold shrink-0 transition ${
                    selectedGradeId === null ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  onClick={() => setSelectedGradeId(null)}
                >
                  Tất cả
                </button>
                {grades.map((g) => (
                  <button
                    key={g.id}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold shrink-0 transition ${
                      selectedGradeId === g.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                    onClick={() => setSelectedGradeId(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="p-2 border-b border-slate-100">
              <input
                id="schedule-search"
                className="input text-xs"
                placeholder={mode === 'class' ? 'Tìm mã lớp hoặc tên lớp…' : 'Tìm mã hoặc họ tên GV…'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Entity List */}
            <div className="schedule-list flex-1">
              {filteredBrowserItems.map(({ item, placed, required }) => {
                const isComplete = required > 0 && placed >= required
                const isSelected = selectedId === item.id
                return (
                  <button
                    id={`schedule-target-${item.id}`}
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={`schedule-list-item ${isSelected ? 'active' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <strong className="truncate text-xs font-bold text-slate-800">{item.code}</strong>
                        {mode === 'class' && (
                          <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500">
                            {SHIFT_LABEL[(item as SchoolClass).shift]}
                          </span>
                        )}
                      </div>
                      <span className="block truncate text-[11px] text-slate-500">
                        {mode === 'class' ? item.name : (item as Teacher).fullName}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`schedule-count ${isComplete ? 'complete' : ''}`}
                        title={`Đã xếp ${placed}/${required} tiết`}
                      >
                        {isComplete ? '✓ Đủ' : `${placed}/${required}`}
                      </span>
                    </div>
                  </button>
                )
              })}
              {filteredBrowserItems.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy kết quả phù hợp.</div>
              )}
            </div>
          </aside>

          {/* RIGHT: TIMETABLE GRID & UNPLACED PALETTE */}
          <section className="schedule-workspace flex-1 flex flex-col min-h-0 space-y-3">
            {/* Entity Info Strip & School Progress */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <div>
                {selectedClass && mode === 'class' && (
                  <div className="flex items-center gap-2">
                    <strong className="text-base font-bold text-slate-900">Lớp {selectedClass.code}</strong>
                    <span className="text-xs text-slate-500">— {selectedClass.name}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      Ca {SHIFT_LABEL[selectedClass.shift].toLowerCase()}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Tối đa {selectedClass.maxPeriodsPerDay} tiết/ngày
                    </span>
                  </div>
                )}
                {selectedTeacher && mode === 'teacher' && (
                  <div className="flex items-center gap-2">
                    <strong className="text-base font-bold text-slate-900">{selectedTeacher.fullName}</strong>
                    <span className="text-xs text-slate-500">({selectedTeacher.code})</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Tối đa {selectedTeacher.maxPeriodsPerDay} tiết/ngày
                    </span>
                  </div>
                )}
              </div>

              {/* Progress and quick scope actions */}
              <div className="flex items-center gap-3">
                {selectedClass && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      className="btn-ghost px-2.5 py-1 text-xs"
                      onClick={() => openAuto('classes')}
                      title="Chạy thuật toán xếp tự động các tiết còn lại của riêng lớp này"
                    >
                      ⚡ Xếp nhanh lớp
                    </button>
                    <button
                      className="btn-ghost px-2 py-1 text-xs text-slate-600"
                      onClick={clearCurrentClassUnlocked}
                      title="Xóa tất cả các tiết chưa bị khóa cứng của lớp này để xếp lại"
                    >
                      🧹 Xóa chưa khóa
                    </button>
                    <button
                      className="btn-ghost px-2 py-1 text-xs text-slate-600"
                      onClick={() => lockCurrentClass(1)}
                      title="Khóa toàn bộ tiết học hiện tại của lớp này"
                    >
                      🔒 Khóa lớp
                    </button>
                  </div>
                )}

                {progress && (
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-3 text-xs text-slate-600">
                    <span>
                      Tiến độ toàn trường: <strong>{progress.totalPlaced}/{progress.totalRequired}</strong> tiết
                    </span>
                    <strong className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                      {progress.totalRequired ? Math.round((progress.totalPlaced / progress.totalRequired) * 100) : 0}%
                    </strong>
                  </div>
                )}
              </div>
            </div>

            {/* Timetable Grid Table */}
            <div className="schedule-grid-wrap flex-1 shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="th w-24">Tiết / Ca</th>
                    {activeDays.map((d) => (
                      <th key={d.id} className="schedule-day-head">
                        {d.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridPeriods.map((p, idx) => {
                    const prevShift = idx > 0 ? gridPeriods[idx - 1].shift : null
                    return (
                      <tr key={p.id}>
                        {prevShift !== null && prevShift !== p.shift && (
                          <td colSpan={activeDays.length + 1} className="h-1.5 bg-slate-200/70 p-0" />
                        )}
                        <td className="schedule-period-head">
                          <div className="flex items-center justify-between">
                            <strong>{p.name}</strong>
                            <span className="text-[10px] text-slate-400">{p.shift === 'morning' ? 'Sáng' : 'Chiều'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {p.startTime}–{p.endTime}
                          </div>
                        </td>
                        {activeDays.map((d) => {
                          const entry = entryAt(d.id, p.id)
                          const isDragOver = dragOverCell?.dayId === d.id && dragOverCell?.periodId === p.id && (dragOverCell.classId === undefined || dragOverCell.classId === selectedClass?.id)
                          const isConflict = entry && conflictSlotKeys.has(`${d.id}-${p.id}`)

                          return (
                            <td
                              key={d.id}
                              className={`schedule-cell ${isDragOver ? 'schedule-cell-dragover' : ''} ${
                                isConflict ? 'schedule-cell-conflict' : ''
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault()
                                if (dragOverCell?.dayId !== d.id || dragOverCell?.periodId !== p.id || dragOverCell.classId !== selectedClass?.id) {
                                  setDragOverCell({ dayId: d.id, periodId: p.id, classId: selectedClass?.id })
                                }
                              }}
                              onDragLeave={(e) => {
                                if (e.currentTarget.contains(e.relatedTarget as Node)) return
                                setDragOverCell(null)
                              }}
                              onDrop={(e) => onCellDrop(e, d.id, p.id)}
                            >
                              {entry ? (
                                <div
                                  draggable={!entry.locked}
                                  onDragStart={(e) => onDragStartEntry(e, entry)}
                                  onClick={() => setDetailEntry(entry)}
                                  onContextMenu={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void perform(toggleLockAction(entry.id))
                                  }}
                                  title={entry.locked ? 'Tiết đã khóa 🔒 (Chuột phải để mở khóa)' : 'Kéo để đổi chỗ · Chuột phải để khóa'}
                                  className={`schedule-entry ${entry.locked ? 'schedule-entry-locked' : ''}`}
                                  style={{
                                    backgroundColor: `${subjectOf(entry.subjectId)?.color ?? '#3b82f6'}1a`,
                                    borderLeftColor: subjectOf(entry.subjectId)?.color ?? '#3b82f6'
                                  }}
                                >
                                  {/* Card Hover Quick Buttons */}
                                  <div className="cell-hover-actions">
                                    <button
                                      type="button"
                                      className="cell-hover-btn"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        void perform(toggleLockAction(entry.id))
                                      }}
                                      title={entry.locked ? 'Mở khóa' : 'Khóa tiết'}
                                    >
                                      {entry.locked ? '🔓' : '🔒'}
                                    </button>
                                    {!entry.locked && (
                                      <button
                                        type="button"
                                        className="cell-hover-btn hover:!bg-rose-100 hover:!text-rose-700"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          void perform(removeAction(entry))
                                        }}
                                        title="Xóa tiết"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-between gap-1 font-bold text-slate-900">
                                    <span className="truncate">{subjectOf(entry.subjectId)?.name}</span>
                                    {entry.locked === 1 && <span className="text-[11px]">🔒</span>}
                                  </div>
                                  <div className="truncate text-[11px] font-medium text-slate-600">
                                    {mode === 'class'
                                      ? teacherOf(entry.teacherId)?.fullName || teacherOf(entry.teacherId)?.code || '—'
                                      : classOf(entry.classId)?.code}
                                  </div>
                                  {entry.roomId && (
                                    <div className="truncate text-[10px] text-slate-400">
                                      Phòng: {roomOf(entry.roomId)?.name || roomOf(entry.roomId)?.code}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <button
                                  id={`empty-slot-${d.id}-${p.id}`}
                                  className={`empty-slot ${activeBrushAssignmentId ? 'border-blue-400 bg-blue-50/50 text-blue-600' : ''}`}
                                  onClick={() => handleSlotClick(d.id, p.id)}
                                  title={activeBrushAssignmentId ? 'Nhấp để xếp môn đang chọn vào ô này' : 'Nhấp để chọn môn xếp vào ô này'}
                                >
                                  +
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 3. DOCKABLE DRAG & DROP UNPLACED PALETTE */}
            <div className="unplaced-palette">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800">
                    Môn cần xếp
                  </span>
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                    {missingPeriodsForSelected} tiết thiếu
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Kéo thả vào lưới · bấm thẻ để bật xếp liên tiếp
                  </span>
                </div>
                <button
                  id="toggle-completed-subjects"
                  type="button"
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => setShowCompletedSubjects((value) => !value)}
                >
                  {showCompletedSubjects ? 'Chỉ hiện môn thiếu' : 'Hiện cả môn đã đủ'}
                </button>
                {activeBrushAssignmentId && (
                  <button
                    className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 hover:bg-amber-200"
                    onClick={() => setActiveBrushAssignmentId(null)}
                  >
                    ✕ Hủy chế độ cọ vẽ (Esc)
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {paletteItems.length === 0 ? (
                  <div className="w-full py-2 text-center text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg">
                    ✓ Đã xếp đủ 100% tất cả các tiết cho {mode === 'class' ? 'lớp' : 'giáo viên'} này!
                  </div>
                ) : (
                  paletteItems.map((item) => {
                    const subject = subjectOf(item.subjectId)
                    const other = mode === 'class' ? teacherOf(item.teacherId) : classOf(item.classId)
                    const countLeft = Math.max(0, item.required - item.placed)
                    const isComplete = countLeft === 0
                    const isBrushActive = activeBrushAssignmentId === item.assignmentId

                    return (
                      <div
                        key={item.assignmentId}
                        draggable={!isComplete}
                        onDragStart={(e) => {
                          if (!isComplete) onDragStartUnplaced(e, item.assignmentId)
                        }}
                        onClick={() => {
                          if (!isComplete) setActiveBrushAssignmentId(isBrushActive ? null : item.assignmentId)
                        }}
                        className={`palette-card ${isBrushActive ? 'palette-card-active' : ''} ${isComplete ? 'palette-card-complete' : ''}`}
                        style={{ borderLeftColor: subject?.color, borderLeftWidth: '4px' }}
                        title={isComplete ? 'Môn này đã xếp đủ' : 'Kéo vào lưới hoặc bấm để chọn xếp liên tiếp'}
                      >
                        <div className="flex min-w-0 items-start gap-1.5">
                          <span className="mt-0.5 shrink-0 text-sm leading-none text-slate-400" aria-hidden="true">
                            ⠿
                          </span>
                          <div className="min-w-0">
                          <strong className="block truncate text-xs text-slate-900">{subject?.name ?? 'Chưa đặt tên môn'}</strong>
                          <span className="block truncate text-[10px] text-slate-500">
                            {other ? ('fullName' in other ? other.fullName : other.code) : 'Chưa gán GV'}
                          </span>
                          </div>
                        </div>
                        <span className={`palette-count-badge ${isComplete ? 'palette-count-complete' : ''}`}>
                          {isComplete ? `✓ Đã xếp ${item.placed}` : `${item.placed}/${item.required} · còn ${countLeft}`}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 4. MODALS */}

      {/* Create New Plan Modal */}
      <Modal
        title="Tạo Phương Án Thời Khóa Biểu Mới"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCreateOpen(false)}>
              Hủy
            </button>
            <button className="btn-primary" onClick={createTimetable}>
              Tạo phương án
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Tên phương án</label>
            <input
              className="input"
              placeholder="Ví dụ: Phương án 2 (Xếp thử nghiệm)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTimetable()}
            />
          </div>
          <p className="text-xs text-slate-500">
            Phương án mới sẽ được khởi tạo với bảng lịch trống để bạn tự do xếp tay hoặc chạy tự động.
          </p>
        </div>
      </Modal>

      {/* Clone Plan Modal */}
      <Modal
        title="Nhân Bản Phương Án Thời Khóa Biểu"
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setCloneOpen(false)}>
              Hủy
            </button>
            <button className="btn-primary" onClick={cloneTimetable}>
              Nhân bản
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Tên phương án bản sao</label>
            <input
              className="input"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && cloneTimetable()}
            />
          </div>
          <p className="text-xs text-slate-500">
            Toàn bộ các tiết đã xếp và tiết đã khóa của phương án gốc sẽ được sao chép nguyên vẹn sang phương án mới.
          </p>
        </div>
      </Modal>

      {/* Quick Cell Subject Picker Popover */}
      <Modal
        title="Chọn môn học xếp vào ô này"
        open={pickerCell !== null}
        onClose={() => setPickerCell(null)}
      >
        <div className="space-y-1.5">
          {remainingForSelected.length === 0 ? (
            <p className="text-sm text-slate-500 py-3 text-center">Không còn môn nào cần xếp thêm cho đối tượng này.</p>
          ) : (
            remainingForSelected.map((i) => {
              const subject = subjectOf(i.subjectId)
              const other = mode === 'class' ? teacherOf(i.teacherId) : classOf(i.classId)
              return (
                <button
                  key={i.assignmentId}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-2.5 text-left text-sm hover:border-blue-300 hover:bg-blue-50/60 transition"
                  onClick={() => {
                    if (!pickerCell) return
                    void perform(placeAction(i.assignmentId, pickerCell.dayId, pickerCell.periodId))
                    setPickerCell(null)
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: subject?.color }} />
                    <strong className="text-slate-900">{subject?.name}</strong>
                    {other && (
                      <span className="text-xs text-slate-500">
                        · {'fullName' in other ? other.fullName : other.code}
                      </span>
                    )}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    còn {i.required - i.placed} tiết
                  </span>
                </button>
              )
            })
          )}
        </div>
      </Modal>

      {/* Detail Entry Modal */}
      <Modal
        title="Chi tiết tiết học"
        open={detailEntry !== null}
        onClose={() => setDetailEntry(null)}
        footer={
          detailEntry && (
            <>
              <button
                className="btn-ghost"
                onClick={async () => {
                  await perform(toggleLockAction(detailEntry.id))
                  setDetailEntry(null)
                }}
              >
                {detailEntry.locked ? '🔓 Mở khóa tiết' : '🔒 Khóa tiết này'}
              </button>
              {!detailEntry.locked && (
                <ConfirmButton
                  label="Xóa khỏi lưới"
                  message="Xóa tiết này khỏi lưới? Phân công gốc không bị mất."
                  onConfirm={async () => {
                    await perform(removeAction(detailEntry))
                    setDetailEntry(null)
                  }}
                />
              )}
            </>
          )
        }
      >
        {detailEntry && (
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 space-y-1.5 border border-slate-100">
              <div>
                <span className="text-slate-500">Lớp:</span> <strong>{classOf(detailEntry.classId)?.code}</strong> — {classOf(detailEntry.classId)?.name}
              </div>
              <div>
                <span className="text-slate-500">Môn học:</span> <strong style={{ color: subjectOf(detailEntry.subjectId)?.color }}>{subjectOf(detailEntry.subjectId)?.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Giáo viên phụ trách:</span> <strong>{teacherOf(detailEntry.teacherId)?.fullName ?? '— Chưa gán —'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Phòng học:</span> <strong>{roomOf(detailEntry.roomId)?.name ?? '— Phòng mặc định —'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Trạng thái khóa:</span>{' '}
                <span className={detailEntry.locked ? 'font-bold text-amber-700' : 'text-slate-600'}>
                  {detailEntry.locked ? '🔒 Đã khóa cứng' : 'Mở (Có thể di chuyển khi xếp tự động)'}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Floating AutoSolve Modal */}
      {autoModalOpen && (
        <Modal
          title="Tự Động Xếp Lịch Bằng AI & OR-Tools CP-SAT"
          open={autoModalOpen}
          onClose={() => setAutoModalOpen(false)}
        >
          <div className="min-w-[650px] max-h-[80vh] overflow-y-auto">
            <AutoSolvePage
              key={JSON.stringify(autoRequest)}
              semesterId={semesterId}
              embedded
              initialRequest={autoRequest}
              onApplied={async (appliedTimetable) => {
                setTimetableId(appliedTimetable.id)
                await loadTimetables()
                setAutoModalOpen(false)
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
