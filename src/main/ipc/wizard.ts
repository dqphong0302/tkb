import { eq } from 'drizzle-orm'
import { db, schema } from '../db'
import { handle, semesterScope } from './util'
import type { WizardStepStatus } from '@shared/types'

export function registerWizardHandlers(): void {
  handle('wizard:status', (payload): WizardStepStatus[] => {
    const { semesterId } = semesterScope.parse(payload)
    const grades = db().select().from(schema.grade).where(eq(schema.grade.semesterId, semesterId)).all()
    const classes = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.semesterId, semesterId)).all()
    const days = db().select().from(schema.teachingDay).where(eq(schema.teachingDay.semesterId, semesterId)).all()
    const periods = db().select().from(schema.period).where(eq(schema.period.semesterId, semesterId)).all()
    const rooms = db().select().from(schema.room).where(eq(schema.room.semesterId, semesterId)).all()
    const subjects = db().select().from(schema.subject).where(eq(schema.subject.semesterId, semesterId)).all()
    const teachers = db().select().from(schema.teacher).where(eq(schema.teacher.semesterId, semesterId)).all()
    const homerooms = db()
      .select()
      .from(schema.homeroomAssignment)
      .where(eq(schema.homeroomAssignment.semesterId, semesterId))
      .all()
    const assignments = db()
      .select()
      .from(schema.teachingAssignment)
      .where(eq(schema.teachingAssignment.semesterId, semesterId))
      .all()

    const activeDays = days.filter((d) => d.isActive === 1)
    const morning = periods.filter((p) => p.shift === 'morning')
    const afternoon = periods.filter((p) => p.shift === 'afternoon')

    const calendarIssues: string[] = []
    if (activeDays.length === 0) calendarIssues.push('Chưa chọn ngày học nào.')
    if (classes.some((c) => c.shift !== 'afternoon') && morning.length === 0)
      calendarIssues.push('Có lớp học ca sáng nhưng chưa khai báo tiết sáng.')
    if (classes.some((c) => c.shift !== 'morning') && afternoon.length === 0)
      calendarIssues.push('Có lớp học ca chiều nhưng chưa khai báo tiết chiều.')

    const classIssues: string[] = []
    for (const c of classes) {
      const slots = c.shift === 'full' ? periods.length : c.shift === 'morning' ? morning.length : afternoon.length
      if (c.maxPeriodsPerDay > slots && slots > 0)
        classIssues.push(`Lớp ${c.code}: số tiết tối đa trong ngày lớn hơn số tiết của ca học.`)
    }

    const teacherIssues: string[] = []
    const homeroomByTeacher = new Map<number, number>()
    for (const h of homerooms) homeroomByTeacher.set(h.teacherId, (homeroomByTeacher.get(h.teacherId) ?? 0) + 1)
    for (const [teacherId, count] of homeroomByTeacher) {
      if (count > 1) {
        const t = teachers.find((x) => x.id === teacherId)
        teacherIssues.push(`Giáo viên ${t?.code ?? teacherId} đang chủ nhiệm ${count} lớp.`)
      }
    }

    const assignIssues: string[] = []
    const noTeacher = assignments.filter((a) => !a.teacherId).length
    if (noTeacher > 0) assignIssues.push(`${noTeacher} phân công chưa có giáo viên.`)

    const weekIssues: string[] = []
    const zeroPeriods = assignments.filter((a) => a.periodsPerWeek <= 0).length
    if (zeroPeriods > 0) weekIssues.push(`${zeroPeriods} phân công chưa nhập số tiết mỗi tuần.`)
    const classesWithoutAssignment = classes.filter(
      (c) => !assignments.some((a) => a.classId === c.id)
    )
    if (classesWithoutAssignment.length > 0)
      weekIssues.push(`${classesWithoutAssignment.length} lớp chưa có phân công nào.`)

    const steps: WizardStepStatus[] = [
      { key: 'grade', count: grades.length, done: grades.length > 0, optional: false, issues: [] },
      { key: 'class', count: classes.length, done: classes.length > 0, optional: false, issues: classIssues },
      {
        key: 'calendar',
        count: activeDays.length * periods.length,
        done: calendarIssues.length === 0,
        optional: false,
        issues: calendarIssues
      },
      { key: 'room', count: rooms.length, done: true, optional: true, issues: [] },
      { key: 'subject', count: subjects.length, done: subjects.length > 0, optional: false, issues: [] },
      { key: 'teacher', count: teachers.length, done: teachers.length > 0, optional: false, issues: [] },
      {
        key: 'homeroom',
        count: homerooms.length,
        done: classes.length > 0 && homerooms.length === classes.length,
        optional: false,
        issues: teacherIssues
      },
      {
        key: 'assignment',
        count: assignments.length,
        done: assignments.length > 0 && noTeacher === 0,
        optional: false,
        issues: assignIssues
      },
      {
        key: 'periodsPerWeek',
        count: assignments.reduce((sum, a) => sum + a.periodsPerWeek, 0),
        done: assignments.length > 0 && weekIssues.length === 0,
        optional: false,
        issues: weekIssues
      }
    ]
    return steps
  })
}
