const fs = require('fs');
const path = require('path');
const router = require('express').Router();
const db = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler, ok, httpError } = require('../utils/helpers');
const backup = require('../services/backup');

router.use(authenticate);

const summary = async () => {
  const s = await backup.getSettings();
  const files = backup.listBackups(s.folder);
  const next = backup.nextRun(s);
  return {
    settings: {
      enabled: s.enabled, every_days: s.every_days, run_time: s.run_time, keep_count: s.keep_count, folder: s.folder,
      updated_by: s.updated_by, updated_at: s.updated_at,
    },
    status: {
      last_backup_at: s.last_backup_at, last_status: s.last_status, last_message: s.last_message,
      next_backup_at: next ? next.toISOString() : null, running: backup.isRunning(),
      total_backups: files.length, total_size: files.reduce((a, f) => a + f.size, 0),
    },
    backups: files,
  };
};

router.get('/', authorize('database-backup', 'view'), asyncHandler(async (req, res) => ok(res, await summary())));

router.put('/settings', authorize('database-backup', 'edit'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const enabled = b.enabled === undefined ? true : !!b.enabled;
  const every = Number(b.every_days);
  if (!Number.isInteger(every) || every < 1 || every > 365) throw httpError(400, 'Enter how often to back up: 1 to 365 days');
  const time = String(b.run_time || '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw httpError(400, 'Enter a valid backup time');
  const keep = Number(b.keep_count);
  if (!Number.isInteger(keep) || keep < 0 || keep > 1000) throw httpError(400, 'Enter how many backups to keep (0 keeps all)');
  const folder = String(b.folder || '').trim();
  if (!folder) throw httpError(400, 'Enter the folder where backups are saved');
  if (!path.isAbsolute(folder)) throw httpError(400, 'Enter the full folder path, e.g. D:\\PharmacyBackups');
  try {
    backup.ensureFolder(folder);
  } catch {
    throw httpError(400, `Cannot create or write to the folder ${folder}`);
  }
  await db.query(
    `UPDATE backup_settings SET enabled = $1, every_days = $2, run_time = $3, keep_count = $4, folder = $5,
       updated_by = $6, updated_at = now() WHERE id = 1`,
    [enabled, every, time, keep, folder, req.user.name || req.user.username]);
  ok(res, await summary(), 'Backup settings saved');
}));

router.post('/', authorize('database-backup', 'create'), asyncHandler(async (req, res) => {
  const file = await backup.runBackup('manual');
  ok(res, { file, ...(await summary()) }, 'Backup completed', 201);
}));

const fileOf = async (name) => {
  if (!backup.FILE_RE.test(String(name || ''))) throw httpError(400, 'Invalid backup file');
  const s = await backup.getSettings();
  const file = path.join(s.folder, name);
  if (!fs.existsSync(file)) throw httpError(404, 'Backup file not found');
  return file;
};

router.get('/:name/download', authorize('database-backup', 'view'), asyncHandler(async (req, res) => {
  const file = await fileOf(req.params.name);
  res.download(file, req.params.name);
}));

router.delete('/:name', authorize('database-backup', 'delete'), asyncHandler(async (req, res) => {
  const file = await fileOf(req.params.name);
  fs.unlinkSync(file);
  ok(res, await summary(), 'Backup deleted');
}));

module.exports = router;
