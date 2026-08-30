import type { ConstraintLevel, PeriodShift, Shift } from './types'

export const WEEKDAYS: { weekday: number; name: string }[] = [
  { weekday: 2, name: 'Thứ 2' },
  { weekday: 3, name: 'Thứ 3' },
  { weekday: 4, name: 'Thứ 4' },
  { weekday: 5, name: 'Thứ 5' },
  { weekday: 6, name: 'Thứ 6' },
  { weekday: 7, name: 'Thứ 7' },
  { weekday: 8, name: 'Chủ nhật' }
]
export const SHIFT_LABEL: Record<Shift, string> = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  full: 'Cả ngày'
}

export const PERIOD_SHIFT_LABEL: Record<PeriodShift, string> = {
  morning: 'Sáng',
  afternoon: 'Chiều'
}

export const LEVEL_LABEL: Record<ConstraintLevel, string> = {
  off: 'Không áp dụng',
  low: 'Thấp',
  medium: 'Vừa',
  high: 'Cao'
}

export const WIZARD_STEPS: { key: string; title: string; optional?: boolean }[] = [
  { key: 'grade', title: 'Khối' },
  { key: 'class', title: 'Lớp' },
  { key: 'calendar', title: 'Ngày học và tiết học' },
  { key: 'room', title: 'Phòng học', optional: true },
  { key: 'subject', title: 'Môn học' },
  { key: 'teacher', title: 'Giáo viên' },
  { key: 'homeroom', title: 'Giáo viên chủ nhiệm' },
  { key: 'assignment', title: 'Phân công giảng dạy' },
  { key: 'periodsPerWeek', title: 'Số tiết mỗi tuần' }
]

export interface ConstraintDefinition {
  id: string
  code: string
  name: string
  kind: 'hard' | 'soft'
  configuredIn: string
  description: string
  defaultLevel?: ConstraintLevel
}

export const SYSTEM_CONSTRAINTS: ConstraintDefinition[] = [
  {
    id: 'h1_class_single',
    code: 'H1',
    name: 'Không trùng tiết của Lớp',
    kind: 'hard',
    configuredIn: 'Toàn hệ thống (Bộ giải)',
    description: 'Một lớp không bao giờ được xếp học 2 môn trong cùng một tiết.'
  },
  {
    id: 'h2_teacher_single',
    code: 'H2',
    name: 'Không trùng tiết của Giáo viên',
    kind: 'hard',
    configuredIn: 'Toàn hệ thống (Bộ giải)',
    description: 'Một giáo viên không bao giờ bị xếp dạy 2 lớp trong cùng một tiết.'
  },
  {
    id: 'h3_room_single',
    code: 'H3',
    name: 'Không trùng Phòng học',
    kind: 'hard',
    configuredIn: 'Danh mục Phòng',
    description: 'Một phòng học không được xếp cho 2 lớp cùng sử dụng trong cùng một tiết.'
  },
  {
    id: 'h4_periods_per_week',
    code: 'H4',
    name: 'Đúng số tiết quy định / tuần',
    kind: 'hard',
    configuredIn: 'Phân công giảng dạy',
    description: 'Mỗi môn của từng lớp phải được xếp đủ 100% số tiết quy định trong tuần (ở chế độ đầy đủ).'
  },
  {
    id: 'h5_class_shift',
    code: 'H5',
    name: 'Đúng ca học của Lớp',
    kind: 'hard',
    configuredIn: 'Danh mục Lớp',
    description: 'Lớp ca sáng chỉ học ca sáng, lớp ca chiều chỉ học ca chiều, lớp cả ngày học cả hai ca.'
  },
  {
    id: 'h6_teacher_busy',
    code: 'H6',
    name: 'Tuân thủ Lịch bận Giáo viên',
    kind: 'hard',
    configuredIn: 'Giáo viên → Lịch bận',
    description: 'Giáo viên không bị xếp lịch vào những tiết/buổi đã đánh dấu bận.'
  },
  {
    id: 'h7_slot_off',
    code: 'H7',
    name: 'Lịch nghỉ Lớp và Phòng',
    kind: 'hard',
    configuredIn: 'Lớp / Phòng → Lịch nghỉ',
    description: 'Lớp hoặc phòng học không bị xếp vào những tiết đã đánh dấu nghỉ.'
  },
  {
    id: 'h8_class_max_day',
    code: 'H8',
    name: 'Giới hạn số tiết / ngày của Lớp',
    kind: 'hard',
    configuredIn: 'Danh mục Lớp',
    description: 'Tổng số tiết trong một ngày của lớp không được vượt quá định mức (mặc định 5 tiết/ngày).'
  },
  {
    id: 'h9_teacher_max_day',
    code: 'H9',
    name: 'Giới hạn số tiết / ngày của Giáo viên',
    kind: 'hard',
    configuredIn: 'Danh mục Giáo viên',
    description: 'Tổng số tiết dạy trong ngày của giáo viên không vượt quá định mức (mặc định 5 tiết/ngày).'
  },
  {
    id: 'h10_subject_max_day',
    code: 'H10',
    name: 'Giới hạn số tiết / ngày của Môn',
    kind: 'hard',
    configuredIn: 'Danh mục Môn học',
    description: 'Một môn học ở một lớp không vượt quá số tiết tối đa/ngày (mặc định 2 tiết/ngày).'
  },
  {
    id: 'h11_mandatory_double',
    code: 'H11',
    name: 'Tiết đôi bắt buộc liền nhau',
    kind: 'hard',
    configuredIn: 'Phân công giảng dạy',
    description: 'Các cặp tiết đôi đánh dấu bắt buộc phải xếp liên tiếp trong cùng một buổi học.'
  },
  {
    id: 'h12_min_gap_days',
    code: 'H12',
    name: 'Khoảng cách ngày tối thiểu giữa các buổi',
    kind: 'hard',
    configuredIn: 'Danh mục Môn học',
    description: 'Các buổi học của cùng một môn ở một lớp phải cách nhau tối thiểu số ngày quy định.'
  },
  {
    id: 'h13_locked_entries',
    code: 'H13',
    name: 'Bảo toàn tuyệt đối Tiết đã Khóa',
    kind: 'hard',
    configuredIn: 'Lưới Thời khóa biểu',
    description: 'Tất cả tiết có biểu tượng khóa hoặc ngoài phạm vi giải được giữ nguyên 100% vị trí.'
  },
  {
    id: 's1_teacher_gaps',
    code: 'S1',
    name: 'Giảm tiết trống của Giáo viên',
    kind: 'soft',
    configuredIn: 'Cài đặt / Auto Solve',
    description: 'Tối thiểu hóa số tiết trống nằm giữa tiết đầu và tiết cuối trong cùng một buổi của giáo viên.',
    defaultLevel: 'medium'
  },
  {
    id: 's2_subject_spread',
    code: 'S2',
    name: 'Phân bố Môn đều trong tuần',
    kind: 'soft',
    configuredIn: 'Cài đặt / Auto Solve',
    description: 'Phân bố các tiết của môn học trải đều các ngày trong tuần, tránh dồn cục.',
    defaultLevel: 'medium'
  },
  {
    id: 's3_teacher_prefer',
    code: 'S3',
    name: 'Ưu tiên Tiết mong muốn của GV',
    kind: 'soft',
    configuredIn: 'Giáo viên → Lịch ưu tiên',
    description: 'Thưởng điểm khi xếp giáo viên vào các khung giờ giáo viên ưu tiên đăng ký dạy.',
    defaultLevel: 'low'
  },
  {
    id: 's4_avoid_single',
    code: 'S4',
    name: 'Hạn chế Giáo viên dạy 1 tiết / buổi',
    kind: 'soft',
    configuredIn: 'Cài đặt / Auto Solve',
    description: 'Tránh trường hợp giáo viên chỉ đến trường dạy duy nhất 1 tiết trong một buổi sáng hoặc chiều.',
    defaultLevel: 'medium'
  },
  {
    id: 's5_soft_double',
    code: 'S5',
    name: 'Ưu tiên ghép Tiết đôi không bắt buộc',
    kind: 'soft',
    configuredIn: 'Cài đặt / Auto Solve',
    description: 'Ưu tiên xếp 2 tiết liền nhau cho các môn cho phép tiết đôi khi chưa đánh dấu bắt buộc.',
    defaultLevel: 'low'
  }
]

export const CONSTRAINT_PRESETS = [
  {
    id: 'thcs',
    name: 'THCS Chuẩn',
    description: 'Phù hợp trường cấp 2: 5 tiết/buổi, ưu tiên tránh tiết trống cao, phân tán môn vừa phải.',
    weights: {
      teacherGaps: 2 as const,
      subjectSpread: 2 as const,
      teacherPrefer: 1 as const,
      avoidSinglePeriod: 2 as const,
      softDoublePairs: 1 as const
    },
    timeLimit: 120,
    mode: 'full' as const
  },
  {
    id: 'thpt',
    name: 'THPT Tối ưu cao',
    description: 'Phù hợp trường cấp 3: Nhiều môn tiết đôi, ưu tiên tránh tiết trống và lịch giáo viên.',
    weights: {
      teacherGaps: 3 as const,
      subjectSpread: 2 as const,
      teacherPrefer: 2 as const,
      avoidSinglePeriod: 2 as const,
      softDoublePairs: 2 as const
    },
    timeLimit: 180,
    mode: 'full' as const
  },
  {
    id: 'primary',
    name: 'Tiểu học (2 buổi/ngày)',
    description: 'Phù hợp trường tiểu học học cả ngày: Ưu tiên phân bố môn đều cao, tải đều các ngày.',
    weights: {
      teacherGaps: 1 as const,
      subjectSpread: 3 as const,
      teacherPrefer: 1 as const,
      avoidSinglePeriod: 1 as const,
      softDoublePairs: 0 as const
    },
    timeLimit: 90,
    mode: 'full' as const
  },
  {
    id: 'quick',
    name: 'Xếp nhanh',
    description: 'Chạy nhanh trong thời gian ngắn để kiểm tra tính khả thi của dữ liệu đầu vào.',
    weights: {
      teacherGaps: 1 as const,
      subjectSpread: 1 as const,
      teacherPrefer: 0 as const,
      avoidSinglePeriod: 0 as const,
      softDoublePairs: 0 as const
    },
    timeLimit: 45,
    mode: 'full' as const
  }
]
