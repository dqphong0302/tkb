import { registerAppHandlers } from './app'
import { registerEntityHandlers } from './entities'
import { registerHomeroomHandlers } from './homeroom'
import { registerAssignmentHandlers } from './assignment'
import { registerWizardHandlers } from './wizard'
import { registerTimetableHandlers } from './timetable'
import { registerSolverHandlers } from './solver'
import { registerSubjectGradeHandlers } from './subjectGrade'
import { registerTeacherAvailabilityHandlers } from './teacherAvailability'
import { registerSpreadsheetHandlers } from './spreadsheet'
import { registerPublicationHandlers } from './publication'
import { registerBackupHandlers } from './backup'
import { registerSlotAvailabilityHandlers } from './slotAvailability'
import { registerConstraintHandlers } from './constraint'

export function registerIpcHandlers(): void {
  registerAppHandlers()
  registerEntityHandlers()
  registerHomeroomHandlers()
  registerAssignmentHandlers()
  registerWizardHandlers()
  registerTimetableHandlers()
  registerSolverHandlers()
  registerSubjectGradeHandlers()
  registerTeacherAvailabilityHandlers()
  registerSpreadsheetHandlers()
  registerPublicationHandlers()
  registerBackupHandlers()
  registerSlotAvailabilityHandlers()
  registerConstraintHandlers()
}
