import { app, dialog } from 'electron'
import { copyFile, stat } from 'fs/promises'
import Database from 'better-sqlite3'
import { dirname, join } from 'path'
import { asc, eq } from 'drizzle-orm'
import { closeDb, db, getDbPath, raw, schema } from '../db'
import { handle, semesterScope } from './util'
import { getContext } from './context'

function backupName(prefix = 'sao-luu-tkb'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix}-${timestamp}.tkb`
}

async function copyCurrentDatabase(destination: string): Promise<void> {
  raw().pragma('wal_checkpoint(TRUNCATE)')
  await copyFile(getDbPath(), destination)
}

function recordBackup(semesterId: number, filePath: string): void {
  const context = getContext(semesterId)
  db().insert(schema.backupRecord).values({
    schoolId: context.schoolId,
    semesterId,
    filePath,
    appVersion: app.getVersion(),
    createdAt: Date.now()
  }).run()
}

function validateBackup(filePath: string): void {
  const source = new Database(filePath, { readonly: true, fileMustExist: true })
  try {
    const school = source.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'school'").get()
    const semester = source.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'semester'").get()
    if (!school || !semester) throw new Error('Tệp không phải là bản sao lưu Thời khóa biểu hợp lệ.')
  } finally {
    source.close()
  }
}

export function registerBackupHandlers(): void {
  handle('backup:list', (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    const context = getContext(semesterId)
    return db().select().from(schema.backupRecord).where(eq(schema.backupRecord.schoolId, context.schoolId)).orderBy(asc(schema.backupRecord.createdAt)).all().reverse()
  })

  handle('backup:create', async (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    const filePath = dialog.showSaveDialogSync({ defaultPath: backupName(), filters: [{ name: 'Sao lưu TKB', extensions: ['tkb', 'db'] }] })
    if (!filePath) return { filePath: null }
    await copyCurrentDatabase(filePath)
    recordBackup(semesterId, filePath)
    return { filePath }
  })

  handle('backup:restore', async (payload) => {
    const { semesterId } = semesterScope.parse(payload)
    const sourcePath = dialog.showOpenDialogSync({ properties: ['openFile'], filters: [{ name: 'Sao lưu TKB', extensions: ['tkb', 'db'] }] })?.[0]
    if (!sourcePath) return { restarting: false, automaticBackupPath: null }
    validateBackup(sourcePath)
    const dbPath = getDbPath()
    if (sourcePath === dbPath) throw new Error('Không thể khôi phục từ chính cơ sở dữ liệu đang dùng.')
    const automaticBackupPath = join(dirname(dbPath), backupName('truoc-khi-khoi-phuc'))
    await copyCurrentDatabase(automaticBackupPath)
    recordBackup(semesterId, automaticBackupPath)
    await stat(sourcePath)
    closeDb()
    await copyFile(sourcePath, dbPath)
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 150)
    return { restarting: true, automaticBackupPath }
  })
}
