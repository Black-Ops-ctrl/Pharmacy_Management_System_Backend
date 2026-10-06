const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../config/db');

const FILE_RE = /^pharmacy_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(auto|manual)\.sql$/;
const DEFAULT_FOLDER = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const CHECK_EVERY_MS = 60 * 1000;

let running = false;
let timer = null;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

const getSettings = async () => {
  await db.query('INSERT INTO backup_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
  const s = (await db.query('SELECT * FROM backup_settings WHERE id = 1')).rows[0];
  return { ...s, folder: s.folder || DEFAULT_FOLDER };
};

// Finds pg_dump: BACKUP_PG_DUMP env, then the PostgreSQL install folders on Windows, then PATH.
const findPgDump = () => {
  if (process.env.BACKUP_PG_DUMP) return process.env.BACKUP_PG_DUMP;
  if (process.platform === 'win32') {
    const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files'].filter(Boolean);
    for (const root of roots) {
      const base = path.join(root, 'PostgreSQL');
      if (!fs.existsSync(base)) continue;
      const versions = fs.readdirSync(base).filter((v) => /^\d+(\.\d+)?$/.test(v)).sort((a, b) => parseFloat(b) - parseFloat(a));
      for (const v of versions) {
        const exe = path.join(base, v, 'bin', 'pg_dump.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
    return 'pg_dump.exe';
  }
  return 'pg_dump';
};

const ensureFolder = (folder) => {
  fs.mkdirSync(folder, { recursive: true });
  fs.accessSync(folder, fs.constants.W_OK);
};

const listBackups = (folder) => {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder)
    .filter((f) => FILE_RE.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(folder, f));
      return { name: f, type: f.endsWith('_auto.sql') ? 'Auto' : 'Manual', size: st.size, created_at: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
};

const prune = (folder, keep) => {
  if (!keep) return;
  listBackups(folder).slice(keep).forEach((b) => {
    try { fs.unlinkSync(path.join(folder, b.name)); } catch { /* file already gone */ }
  });
};

const dump = (file) => new Promise((resolve, reject) => {
  const args = ['-h', process.env.DB_HOST || 'localhost', '-p', String(process.env.DB_PORT || 5432),
    '-U', process.env.DB_USER || 'postgres', '-d', process.env.DB_NAME,
    '--clean', '--if-exists', '--no-owner', '--no-privileges', '--encoding=UTF8', '-f', file];
  let err = '';
  let child;
  try {
    child = spawn(findPgDump(), args, { env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD || '' }, windowsHide: true });
  } catch (e) {
    reject(e);
    return;
  }
  child.stderr.on('data', (d) => { err += d.toString(); });
  child.on('error', (e) => reject(e.code === 'ENOENT'
    ? new Error('pg_dump was not found. Install PostgreSQL client tools or set BACKUP_PG_DUMP in .env')
    : e));
  child.on('close', (code) => (code === 0 ? resolve() : reject(new Error((err.trim().split('\n').pop()) || `pg_dump failed (code ${code})`))));
});

const runBackup = async (type = 'manual') => {
  if (running) { const e = new Error('A backup is already running. Please wait.'); e.status = 409; throw e; }
  running = true;
  const s = await getSettings();
  const now = new Date();
  const name = `pharmacy_${stamp(now)}_${type}.sql`;
  const file = path.join(s.folder, name);
  try {
    ensureFolder(s.folder);
    await dump(file);
    prune(s.folder, Number(s.keep_count) || 0);
    await db.query(
      `UPDATE backup_settings SET last_backup_at = $1, last_status = 'Successful', last_message = NULL${type === 'auto' ? ', last_auto_at = $1' : ''} WHERE id = 1`,
      [now]);
    const st = fs.statSync(file);
    return { name, type: type === 'auto' ? 'Auto' : 'Manual', size: st.size, created_at: st.mtime.toISOString() };
  } catch (e) {
    try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch { /* ignore */ }
    const msg = e.code === 'EACCES' || e.code === 'EPERM' ? `Cannot write to the folder ${s.folder}` : e.message;
    await db.query(`UPDATE backup_settings SET last_status = 'Failed', last_message = $1${type === 'auto' ? ', last_auto_at = $2' : ''} WHERE id = 1`,
      type === 'auto' ? [msg, now] : [msg]).catch(() => {});
    const err = new Error(`Backup failed: ${msg}`);
    err.status = 422;
    throw err;
  } finally {
    running = false;
  }
};

// Next scheduled run:
// - after an auto backup: run_time on (day of last auto backup + every_days)
// - otherwise (never run, or the schedule was changed since): the first run_time after the schedule was saved
// A run that was missed (PC switched off) is taken as soon as the server is running again.
const nextRun = (s) => {
  if (!s.enabled) return null;
  const [h, m] = String(s.run_time || '23:00').split(':').map(Number);
  const at = (d) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const savedAt = new Date(s.updated_at || Date.now());
  if (s.last_auto_at && new Date(s.last_auto_at) >= savedAt) {
    const n = at(s.last_auto_at);
    n.setDate(n.getDate() + (Number(s.every_days) || 1));
    return n;
  }
  const first = at(savedAt);
  if (first <= savedAt) first.setDate(first.getDate() + 1);
  return first;
};

const tick = async () => {
  if (running) return;
  try {
    const s = await getSettings();
    const due = nextRun(s);
    if (due && due <= new Date()) await runBackup('auto');
  } catch (e) {
    console.error('Auto backup:', e.message);
  }
};

const startScheduler = () => {
  if (timer) return;
  timer = setInterval(tick, CHECK_EVERY_MS);
  setTimeout(tick, 15 * 1000);
};

module.exports = { FILE_RE, getSettings, listBackups, runBackup, nextRun, startScheduler, ensureFolder, isRunning: () => running };
