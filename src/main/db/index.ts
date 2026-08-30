import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import Database from 'better-sqlite3'
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import initSql from './migrations/0001_init.sql?raw'
import schoolMaxPeriodsSql from './migrations/0002_school_max_periods.sql?raw'
import subjectGradeSql from './migrations/0003_subject_grade.sql?raw'
import * as schema from './schema'

const MIGRATIONS: string[] = [initSql, schoolMaxPeriodsSql, subjectGradeSql]

let sqlite: Database.Database | null = null
let dbInstance: BetterSQLite3Database<typeof schema> | null = null

export function getDbPath(): string {
  const dir = join(app.getPath('userData'), 'data')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'tkb.db')
}

function runMigrations(conn: Database.Database): void {
  const current = conn.pragma('user_version', { simple: true }) as number
  for (let version = current; version < MIGRATIONS.length; version++) {
    conn.exec('BEGIN')
    try {
      conn.exec(MIGRATIONS[version])
      conn.pragma(`user_version = ${version + 1}`)
      conn.exec('COMMIT')
    } catch (err) {
      conn.exec('ROLLBACK')
      throw err
    }
  }
}

export function initDb(): BetterSQLite3Database<typeof schema> {
  if (dbInstance) return dbInstance
  sqlite = new Database(getDbPath())
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  runMigrations(sqlite)
  dbInstance = drizzle(sqlite, { schema })
  return dbInstance
}

export function db(): BetterSQLite3Database<typeof schema> {
  if (!dbInstance) throw new Error('Cơ sở dữ liệu chưa được khởi tạo')
  return dbInstance
}

export function raw(): Database.Database {
  if (!sqlite) throw new Error('Cơ sở dữ liệu chưa được khởi tạo')
  return sqlite
}

export function closeDb(): void {
  sqlite?.close()
  sqlite = null
  dbInstance = null
}

export { schema }
