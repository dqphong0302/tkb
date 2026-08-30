import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '../db'
import { registerCrud } from './crud'
import { handle } from './util'
import { getContext } from './context'

const semesterId = z.number().int().positive()
const name = (label: string) => z.string().trim().min(1, `${label} không được để trống`)
const optionalId = z.number().int().positive().nullable().optional()

export function registerEntityHandlers(): void {
  registerCrud({
    name: 'grade',
    table: schema.grade,
    createSchema: z.object({
      semesterId,
      name: name('Tên khối'),
      orderNo: z.number().int().default(0)
    }),
    updateSchema: z.object({
      name: name('Tên khối').optional(),
      orderNo: z.number().int().optional()
    }),
    orderColumns: (t) => [asc(t.orderNo), asc(t.id)],
    usageCheck: (id) => {
      const count = db().select().from(schema.schoolClass).where(eq(schema.schoolClass.gradeId, id)).all().length
      return count > 0 ? `Không thể xóa khối vì đang có ${count} lớp thuộc khối này.` : null
    }
  })

  registerCrud({
    name: 'room',
    table: schema.room,
    createSchema: z.object({
      semesterId,
      code: name('Mã phòng'),
      name: name('Tên phòng'),
      kind: z.enum(['normal', 'special']).default('normal'),
      capacity: z.number().int().min(0).default(0),
      note: z.string().default('')
    }),
    updateSchema: z.object({
      code: name('Mã phòng').optional(),
      name: name('Tên phòng').optional(),
      kind: z.enum(['normal', 'special']).optional(),
      capacity: z.number().int().min(0).optional(),
      note: z.string().optional()
    }),
    orderColumns: (t) => [asc(t.code)]
  })

  registerCrud({
    name: 'class',
    table: schema.schoolClass,
    createSchema: z.object({
      semesterId,
      gradeId: z.number().int().positive(),
      code: name('Mã lớp'),
      name: name('Tên lớp'),
      shift: z.enum(['morning', 'afternoon', 'full']).default('morning'),
      maxPeriodsPerDay: z.number().int().min(1).max(15).default(5),
      roomId: optionalId,
      orderNo: z.number().int().default(0)
    }),
    updateSchema: z.object({
      gradeId: z.number().int().positive().optional(),
      code: name('Mã lớp').optional(),
      name: name('Tên lớp').optional(),
      shift: z.enum(['morning', 'afternoon', 'full']).optional(),
      maxPeriodsPerDay: z.number().int().min(1).max(15).optional(),
      roomId: optionalId,
      orderNo: z.number().int().optional()
    }),
    orderColumns: (t) => [asc(t.orderNo), asc(t.code)]
  })

  registerCrud({
    name: 'day',
    table: schema.teachingDay,
    createSchema: z.object({
      semesterId,
      weekday: z.number().int().min(2).max(8),
      name: name('Tên ngày'),
      isActive: z.number().int().min(0).max(1).default(1)
    }),
    updateSchema: z.object({
      name: name('Tên ngày').optional(),
      isActive: z.number().int().min(0).max(1).optional()
    }),
    orderColumns: (t) => [asc(t.weekday)]
  })

  registerCrud({
    name: 'period',
    table: schema.period,
    createSchema: z.object({
      semesterId,
      shift: z.enum(['morning', 'afternoon']),
      orderNo: z.number().int().min(1).max(20),
      name: name('Tên tiết'),
      startTime: z.string().default(''),
      endTime: z.string().default('')
    }),
    updateSchema: z.object({
      orderNo: z.number().int().min(1).max(20).optional(),
      name: name('Tên tiết').optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional()
    }),
    orderColumns: (t) => [asc(t.shift), asc(t.orderNo)]
  })

  registerCrud({
    name: 'subject',
    table: schema.subject,
    createSchema: z.object({
      semesterId,
      code: name('Mã môn'),
      name: name('Tên môn'),
      color: z.string().default('#3b82f6'),
      orderNo: z.number().int().default(0),
      allowDouble: z.number().int().min(0).max(1).default(0),
      maxPerDay: z.number().int().min(1).max(10).default(2),
      minGapDays: z.number().int().min(0).max(6).default(0),
      requiresSpecialRoom: z.number().int().min(0).max(1).default(0),
      roomId: optionalId
    }),
    updateSchema: z.object({
      code: name('Mã môn').optional(),
      name: name('Tên môn').optional(),
      color: z.string().optional(),
      orderNo: z.number().int().optional(),
      allowDouble: z.number().int().min(0).max(1).optional(),
      maxPerDay: z.number().int().min(1).max(10).optional(),
      minGapDays: z.number().int().min(0).max(6).optional(),
      requiresSpecialRoom: z.number().int().min(0).max(1).optional(),
      roomId: optionalId
    }),
    orderColumns: (t) => [asc(t.orderNo), asc(t.code)],
    usageCheck: (id) => {
      const count = db()
        .select()
        .from(schema.teachingAssignment)
        .where(eq(schema.teachingAssignment.subjectId, id))
        .all().length
      return count > 0 ? `Không thể xóa môn vì đang có ${count} phân công sử dụng môn này.` : null
    }
  })

  registerCrud({
    name: 'teacher',
    table: schema.teacher,
    createSchema: z.object({
      semesterId,
      code: name('Mã giáo viên'),
      fullName: name('Họ tên'),
      shortName: z.string().default(''),
      department: z.string().default(''),
      color: z.string().default('#10b981'),
      maxPeriodsPerDay: z.number().int().min(1).max(15).default(5),
      avoidGaps: z.number().int().min(0).max(1).default(0),
      note: z.string().default('')
    }),
    updateSchema: z.object({
      code: name('Mã giáo viên').optional(),
      fullName: name('Họ tên').optional(),
      shortName: z.string().optional(),
      department: z.string().optional(),
      color: z.string().optional(),
      maxPeriodsPerDay: z.number().int().min(1).max(15).optional(),
      avoidGaps: z.number().int().min(0).max(1).optional(),
      note: z.string().optional()
    }),
    orderColumns: (t) => [asc(t.code)]
  })

  handle('period:applyTemplate', (payload) => {
    const input = z
      .object({
        semesterId: z.number().int().positive(),
        template: z.enum(['primary', 'secondary'])
      })
      .parse(payload)

    const { schoolId } = getContext(input.semesterId)
    db().delete(schema.period).where(eq(schema.period.semesterId, input.semesterId)).run()

    let morningList: [string, string, string][] = []
    let afternoonList: [string, string, string][] = []

    if (input.template === 'primary') {
      morningList = [
        ['Tiết 1', '07:30', '08:05'],
        ['Tiết 2', '08:15', '08:50'],
        ['Tiết 3', '09:15', '09:50'],
        ['Tiết 4', '10:00', '10:35']
      ]
      afternoonList = [
        ['Tiết 1', '14:00', '14:35'],
        ['Tiết 2', '14:45', '15:20'],
        ['Tiết 3', '15:35', '16:10']
      ]
    } else {
      morningList = [
        ['Tiết 1', '07:00', '07:45'],
        ['Tiết 2', '07:50', '08:35'],
        ['Tiết 3', '08:50', '09:35'],
        ['Tiết 4', '09:40', '10:25'],
        ['Tiết 5', '10:30', '11:15']
      ]
      afternoonList = [
        ['Tiết 1', '13:30', '14:15'],
        ['Tiết 2', '14:20', '15:05'],
        ['Tiết 3', '15:20', '16:05'],
        ['Tiết 4', '16:10', '16:55'],
        ['Tiết 5', '17:00', '17:45']
      ]
    }

    const periods = [
      ...morningList.map((p, i) => ({
        shift: 'morning' as const,
        orderNo: i + 1,
        name: p[0],
        startTime: p[1],
        endTime: p[2]
      })),
      ...afternoonList.map((p, i) => ({
        shift: 'afternoon' as const,
        orderNo: i + 1,
        name: p[0],
        startTime: p[1],
        endTime: p[2]
      }))
    ].map((p) => ({ ...p, schoolId, semesterId: input.semesterId }))

    db().insert(schema.period).values(periods).run()
    return { success: true, count: periods.length }
  })
}
