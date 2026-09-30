import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ====== CONFIG ======
const PORT = parseInt(process.env.PORT || '5000', 10);
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN || '';
const AI_API_URL = process.env.AI_API_URL || 'https://v3258578.hosted-by-vdsina.ru';
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// ====== INIT ======
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// ====== DATABASE ======
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK(role IN ('resident','master')),
    name TEXT NOT NULL,
    worker_type TEXT CHECK(worker_type IN ('PLUMBER','ELECTRICIAN','CLEANER','LOCKSMITH','LANDSCAPER','MAINTENANCE','UNIVERSAL')),
    default_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS incidents(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    text TEXT,
    address TEXT NOT NULL,
    photo_url TEXT,
    category TEXT CHECK(category IS NULL OR category IN ('WATER_SUPPLY','ELECTRICITY','HEATING','CLEANING','YARD','DOOR','ELEVATOR','ROOF')),
    subcategory TEXT,
    severity TEXT CHECK(severity IS NULL OR severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    confidence REAL,
    input_mode TEXT NOT NULL CHECK(input_mode IN ('TEXT_ONLY','IMAGE_ONLY','TEXT_AND_IMAGE','WEBHOOK')),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE','ASSIGNED','RESOLVED','CANCELLED')),
    master_id TEXT REFERENCES users(id),
    master_name TEXT,
    report TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS reviews(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER NOT NULL UNIQUE REFERENCES incidents(id),
    master_id TEXT NOT NULL REFERENCES users(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_inc_status ON incidents(status);
  CREATE INDEX IF NOT EXISTS idx_inc_user ON incidents(user_id);
  CREATE INDEX IF NOT EXISTS idx_inc_master ON incidents(master_id);
  CREATE INDEX IF NOT EXISTS idx_rev_master ON reviews(master_id);
`);

// ====== TAXONOMY ======
const TAXONOMY: Record<string, { name: string; icon: string; workerType: string; subcategories: Record<string, { name: string; workerType: string; priority: string }> }> = {
  WATER_SUPPLY: { name: 'Водоснабжение', icon: '💧', workerType: 'PLUMBER', subcategories: {
    PIPE_LEAK: { name: 'Протечка трубы', workerType: 'PLUMBER', priority: 'HIGH' },
    NO_WATER: { name: 'Отсутствие воды', workerType: 'PLUMBER', priority: 'MEDIUM' },
    DIRTY_WATER: { name: 'Грязная вода', workerType: 'PLUMBER', priority: 'MEDIUM' },
    LOW_PRESSURE: { name: 'Низкий напор', workerType: 'PLUMBER', priority: 'LOW' }
  }},
  ELECTRICITY: { name: 'Электроснабжение', icon: '⚡', workerType: 'ELECTRICIAN', subcategories: {
    NO_LIGHT_STAIRWELL: { name: 'Нет света на лестнице', workerType: 'ELECTRICIAN', priority: 'MEDIUM' },
    EXPOSED_WIRES: { name: 'Оголённые провода', workerType: 'ELECTRICIAN', priority: 'CRITICAL' },
    ELECTRICAL_PANEL: { name: 'Проблема с электрощитом', workerType: 'ELECTRICIAN', priority: 'HIGH' }
  }},
  HEATING: { name: 'Отопление', icon: '🔥', workerType: 'PLUMBER', subcategories: {
    NO_HEATING: { name: 'Нет отопления', workerType: 'PLUMBER', priority: 'HIGH' },
    RADIATOR_LEAK: { name: 'Протечка батареи', workerType: 'PLUMBER', priority: 'HIGH' },
    LOW_TEMPERATURE: { name: 'Низкая температура', workerType: 'PLUMBER', priority: 'MEDIUM' }
  }},
  CLEANING: { name: 'Уборка', icon: '🧹', workerType: 'CLEANER', subcategories: {
    DIRTY_STAIRWELL: { name: 'Грязный подъезд', workerType: 'CLEANER', priority: 'LOW' },
    DIRTY_ENTRANCE: { name: 'Грязь у входа', workerType: 'CLEANER', priority: 'LOW' },
    TRASH_OVERFLOW: { name: 'Переполнены мусорные баки', workerType: 'CLEANER', priority: 'MEDIUM' }
  }},
  YARD: { name: 'Двор', icon: '🌳', workerType: 'LANDSCAPER', subcategories: {
    FALLEN_TREE: { name: 'Упавшее дерево', workerType: 'LANDSCAPER', priority: 'HIGH' },
    DAMAGED_BENCH: { name: 'Повреждена лавочка', workerType: 'MAINTENANCE', priority: 'LOW' },
    DAMAGED_PLAYGROUND: { name: 'Повреждена детская площадка', workerType: 'MAINTENANCE', priority: 'HIGH' },
    ROAD_DAMAGE: { name: 'Повреждено дорожное покрытие', workerType: 'MAINTENANCE', priority: 'MEDIUM' }
  }},
  DOOR: { name: 'Двери и замки', icon: '🚪', workerType: 'LOCKSMITH', subcategories: {
    BROKEN_ENTRY_DOOR: { name: 'Сломана входная дверь', workerType: 'LOCKSMITH', priority: 'MEDIUM' },
    BROKEN_LOCK: { name: 'Сломан замок', workerType: 'LOCKSMITH', priority: 'MEDIUM' },
    BROKEN_INTERCOM: { name: 'Не работает домофон', workerType: 'ELECTRICIAN', priority: 'LOW' }
  }},
  ELEVATOR: { name: 'Лифт', icon: '🛗', workerType: 'UNIVERSAL', subcategories: {
    ELEVATOR_NOT_WORKING: { name: 'Лифт не работает', workerType: 'UNIVERSAL', priority: 'HIGH' },
    ELEVATOR_NOISE: { name: 'Шум и стуки в лифте', workerType: 'UNIVERSAL', priority: 'MEDIUM' }
  }},
  ROOF: { name: 'Крыша', icon: '🏠', workerType: 'MAINTENANCE', subcategories: {
    ROOF_LEAK: { name: 'Протечка крыши', workerType: 'MAINTENANCE', priority: 'HIGH' },
    DAMAGED_ROOF: { name: 'Повреждена кровля', workerType: 'MAINTENANCE', priority: 'MEDIUM' }
  }}
};

function getWorkerTypeForCategory(category: string | null, subcategory: string | null): string {
  if (!category) return 'UNIVERSAL';
  const cat = TAXONOMY[category];
  if (!cat) return 'UNIVERSAL';
  if (subcategory && cat.subcategories[subcategory]) {
    return cat.subcategories[subcategory].workerType;
  }
  return cat.workerType;
}

function getPriorityForSubcategory(category: string | null, subcategory: string | null): string {
  if (!category) return 'MEDIUM';
  const cat = TAXONOMY[category];
  if (!cat) return 'MEDIUM';
  if (subcategory && cat.subcategories[subcategory]) {
    return cat.subcategories[subcategory].priority;
  }
  return 'MEDIUM';
}

// ====== RATE LIMITING ======
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

// ====== ML API CLIENT ======
async function analyzeText(text: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${AI_API_URL}/api/text/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal as any
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Text API ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function analyzeImage(buffer: Buffer, filename: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: 'image/jpeg' });
    const res = await fetch(`${AI_API_URL}/api/vision/analyze`, {
      method: 'POST',
      body: form,
      signal: controller.signal as any
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Vision API ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

// ====== FUSION ======
function fuseResults(textResult: any, visionResult: any, mode: string) {
  if (mode === 'TEXT_ONLY') {
    if (!textResult || !textResult.category || textResult.confidence < 0.3) {
      return { classificationResult: 'NOT_INCIDENT', category: null, subcategory: null, severity: null, confidence: 0, level: 'LOW' };
    }
    return {
      classificationResult: 'KNOWN_INCIDENT',
      category: textResult.category,
      subcategory: textResult.subcategory,
      severity: getPriorityForSubcategory(textResult.category, textResult.subcategory),
      confidence: textResult.confidence,
      level: 'HIGH'
    };
  }
  if (mode === 'IMAGE_ONLY') {
    if (!visionResult || visionResult.classificationResult === 'NOT_INCIDENT') {
      return { classificationResult: 'NOT_INCIDENT', category: null, subcategory: null, severity: null, confidence: 0, level: 'LOW' };
    }
    return {
      classificationResult: 'NEEDS_CLARIFICATION',
      category: visionResult.category,
      subcategory: null,
      severity: visionResult.visualSeverity || getPriorityForSubcategory(visionResult.category, null),
      confidence: visionResult.confidence,
      level: 'MEDIUM'
    };
  }
  // TEXT_AND_IMAGE
  if (!textResult || !visionResult) {
    return { classificationResult: 'NOT_INCIDENT', category: null, subcategory: null, severity: null, confidence: 0, level: 'LOW' };
  }
  const txCat = textResult.category;
  const vCat = visionResult.category;
  const txCats = (textResult.top3 || []).map((t: any) => t.category).filter(Boolean);
  const vCats = (visionResult.top3 || []).map((t: any) => t.category).filter(Boolean);
  
  if (txCat && vCat && txCat === vCat) {
    return { classificationResult: 'KNOWN_INCIDENT', category: txCat, subcategory: textResult.subcategory, severity: getPriorityForSubcategory(txCat, textResult.subcategory), confidence: (textResult.confidence + visionResult.confidence) / 2, level: 'HIGH' };
  }
  if (txCat && vCats.includes(txCat)) {
    return { classificationResult: 'KNOWN_INCIDENT', category: txCat, subcategory: textResult.subcategory, severity: getPriorityForSubcategory(txCat, textResult.subcategory), confidence: (textResult.confidence + visionResult.confidence) / 2, level: 'MEDIUM', needsReview: true };
  }
  if (vCat && txCats.includes(vCat)) {
    return { classificationResult: 'KNOWN_INCIDENT', category: vCat, subcategory: textResult.subcategory, severity: getPriorityForSubcategory(vCat, textResult.subcategory), confidence: (textResult.confidence + visionResult.confidence) / 2, level: 'MEDIUM', needsReview: true };
  }
  return { classificationResult: 'NEEDS_CLARIFICATION', category: txCat || vCat, subcategory: textResult.subcategory, severity: getPriorityForSubcategory(txCat || vCat, textResult.subcategory), confidence: (textResult.confidence + visionResult.confidence) / 2, level: 'LOW' };
}

// ====== PRUNING ======
function runPruning() {
  try {
    const incCount = (db.prepare('SELECT COUNT(*) as c FROM incidents').get() as any).c;
    if (incCount > 2000) {
      const toDelete = db.prepare("SELECT id FROM incidents WHERE status IN ('RESOLVED','CANCELLED') ORDER BY created_at ASC LIMIT ?").all(incCount - 2000) as any[];
      if (toDelete.length > 0) {
        const ids = toDelete.map(r => r.id);
        db.prepare(`DELETE FROM reviews WHERE incident_id IN (${ids.map(() => '?').join(',')})`).run(...ids);
        db.prepare(`DELETE FROM incidents WHERE id IN (${ids.map(() => '?').join(',')})`).run(...ids);
      }
    }
    const revCount = (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as any).c;
    if (revCount > 5000) {
      db.prepare('DELETE FROM reviews WHERE id IN (SELECT id FROM reviews ORDER BY created_at ASC LIMIT ?)').run(revCount - 5000);
    }
    // Prune uploads
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.'));
    if (files.length > 500) {
      const sorted = files.map(f => ({ name: f, mtime: fs.statSync(path.join(UPLOADS_DIR, f)).mtimeMs })).sort((a, b) => a.mtime - b.mtime);
      const toDelete = sorted.slice(0, files.length - 500);
      for (const f of toDelete) {
        fs.unlinkSync(path.join(UPLOADS_DIR, f.name));
        db.prepare('UPDATE incidents SET photo_url = NULL WHERE photo_url = ?').run(`/uploads/${f.name}`);
      }
    }
  } catch (e) {
    console.error('Pruning error:', e);
  }
}

setInterval(runPruning, 60 * 60 * 1000);
runPruning();

// ====== MULTER ======
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('invalid_mime'));
  }
});

// ====== HELPERS ======
function errorResponse(res: Response, status: number, code: string) {
  return res.status(status).json({ error: code });
}

function validateLength(val: any, max: number, name: string): string | null {
  if (typeof val !== 'string') return null;
  if (val.length > max) return `${name}_too_long`;
  return null;
}

// ====== USERS API ======
app.post('/api/bot/users', (req: Request, res: Response) => {
  if (!checkRateLimit(`user_${req.ip}`, 30)) return errorResponse(res, 429, 'rate_limit');
  const { role, name, worker_type, default_address } = req.body;
  if (!role || !['resident', 'master'].includes(role)) return errorResponse(res, 400, 'invalid_role');
  if (!name || name.length < 1 || name.length > 100) return errorResponse(res, 400, 'invalid_name');
  if (role === 'master' && !worker_type) return errorResponse(res, 400, 'worker_type_required');
  if (role === 'resident' && worker_type) return errorResponse(res, 400, 'worker_type_not_allowed');
  if (worker_type && !['PLUMBER','ELECTRICIAN','CLEANER','LOCKSMITH','LANDSCAPER','MAINTENANCE','UNIVERSAL'].includes(worker_type)) return errorResponse(res, 400, 'invalid_worker_type');
  if (default_address && default_address.length > 200) return errorResponse(res, 400, 'address_too_long');
  
  const id = `web_${crypto.randomUUID()}`;
  db.prepare('INSERT INTO users (id, role, name, worker_type, default_address) VALUES (?, ?, ?, ?, ?)').run(id, role, name, worker_type || null, default_address || null);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json(user);
});

app.get('/api/bot/users/:id', (req: Request, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return errorResponse(res, 404, 'not_found');
  res.json(user);
});

app.patch('/api/bot/users/:id', (req: Request, res: Response) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!user) return errorResponse(res, 404, 'not_found');
  
  const { role, name, worker_type, default_address } = req.body;
  const updates: any = {};
  
  if (role !== undefined) {
    if (!['resident', 'master'].includes(role)) return errorResponse(res, 400, 'invalid_role');
    updates.role = role;
    if (role === 'master' && !worker_type && !user.worker_type) return errorResponse(res, 400, 'worker_type_required');
    if (role === 'resident') updates.worker_type = null;
  }
  if (name !== undefined) {
    if (name.length < 1 || name.length > 100) return errorResponse(res, 400, 'invalid_name');
    updates.name = name;
  }
  if (worker_type !== undefined) {
    if (worker_type && !['PLUMBER','ELECTRICIAN','CLEANER','LOCKSMITH','LANDSCAPER','MAINTENANCE','UNIVERSAL'].includes(worker_type)) return errorResponse(res, 400, 'invalid_worker_type');
    updates.worker_type = worker_type;
  }
  if (default_address !== undefined) {
    if (default_address && default_address.length > 200) return errorResponse(res, 400, 'address_too_long');
    updates.default_address = default_address;
  }
  
  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (sets) {
    db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...Object.values(updates), req.params.id);
  }
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// ====== INCIDENTS API ======
const uploadMiddleware = upload.single('photo');

app.post('/api/bot/incidents', (req: Request, res: Response) => {
  if (!checkRateLimit(`inc_${req.body.user_id || req.ip}`, 30)) return errorResponse(res, 429, 'rate_limit');
  
  uploadMiddleware(req, res, (err: any) => {
    if (err) return errorResponse(res, 400, err.message === 'invalid_mime' ? 'invalid_mime' : 'upload_error');
    
    const { user_id, address, text, category, subcategory, severity, confidence, input_mode } = req.body;
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user) return errorResponse(res, 404, 'user_not_found');
    
    if (!address || address.length < 1 || address.length > 200) return errorResponse(res, 400, 'invalid_address');
    if (text && text.length > 1000) return errorResponse(res, 400, 'text_too_long');
    if (category && !TAXONOMY[category]) return errorResponse(res, 400, 'invalid_category');
    if (severity && !['LOW','MEDIUM','HIGH','CRITICAL'].includes(severity)) return errorResponse(res, 400, 'invalid_severity');
    
    const photo_url = (req.file) ? `/uploads/${req.file.filename}` : null;
    const mode = input_mode || (photo_url && text ? 'TEXT_AND_IMAGE' : photo_url ? 'IMAGE_ONLY' : 'TEXT_ONLY');
    
    const result = db.prepare(`
      INSERT INTO incidents (user_id, text, address, photo_url, category, subcategory, severity, confidence, input_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, text || null, address, photo_url, category || null, subcategory || null, severity || null, confidence || null, mode);
    
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(incident);
  });
});

app.get('/api/bot/incidents', (req: Request, res: Response) => {
  const { user_id, master_id, status } = req.query;
  let sql = 'SELECT i.*, r.rating as review_rating, r.comment as review_comment FROM incidents i LEFT JOIN reviews r ON r.incident_id = i.id WHERE 1=1';
  const params: any[] = [];
  
  if (user_id) { sql += ' AND i.user_id = ?'; params.push(user_id); }
  if (master_id) { sql += ' AND i.master_id = ?'; params.push(master_id); }
  if (status) {
    const statuses = (status as string).split(',');
    sql += ` AND i.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }
  
  sql += ' ORDER BY i.created_at DESC LIMIT 100';
  const rows = db.prepare(sql).all(...params) as any[];
  
  const result = rows.map(row => {
    const review = row.review_rating ? { rating: row.review_rating, comment: row.review_comment } : null;
    const { review_rating, review_comment, ...rest } = row;
    return { ...rest, review };
  });
  
  res.json(result);
});

app.get('/api/bot/incidents/:id', (req: Request, res: Response) => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
  if (!incident) return errorResponse(res, 404, 'not_found');
  const review = db.prepare('SELECT * FROM reviews WHERE incident_id = ?').get(req.params.id) as any;
  res.json({ ...incident, review: review ? { id: review.id, rating: review.rating, comment: review.comment, created_at: review.created_at } : null });
});

app.post('/api/bot/incidents/:id/assign', (req: Request, res: Response) => {
  const { master_id } = req.body;
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
  if (!incident) return errorResponse(res, 404, 'not_found');
  if (incident.status !== 'AVAILABLE') return errorResponse(res, 409, 'already_assigned');
  
  const master = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(master_id, 'master') as any;
  if (!master) return errorResponse(res, 404, 'master_not_found');
  
  const requiredWorker = getWorkerTypeForCategory(incident.category, incident.subcategory);
  if (master.worker_type !== requiredWorker && master.worker_type !== 'UNIVERSAL') {
    if (incident.category === null && master.worker_type !== 'UNIVERSAL') return errorResponse(res, 403, 'wrong_specialty');
    if (incident.category !== null) return errorResponse(res, 403, 'wrong_specialty');
  }
  
  db.prepare("UPDATE incidents SET status = 'ASSIGNED', master_id = ?, master_name = ?, updated_at = datetime('now') WHERE id = ?").run(master_id, master.name, req.params.id);
  const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.post('/api/bot/incidents/:id/resolve', (req: Request, res: Response) => {
  const { master_id, report } = req.body;
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
  if (!incident) return errorResponse(res, 404, 'not_found');
  if (incident.status !== 'ASSIGNED') return errorResponse(res, 409, 'not_assigned');
  if (incident.master_id !== master_id) return errorResponse(res, 403, 'not_your_incident');
  if (report && report.length > 300) return errorResponse(res, 400, 'report_too_long');
  
  db.prepare("UPDATE incidents SET status = 'RESOLVED', report = ?, updated_at = datetime('now') WHERE id = ?").run(report || null, req.params.id);
  const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.post('/api/bot/incidents/:id/cancel', (req: Request, res: Response) => {
  const { user_id } = req.body;
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
  if (!incident) return errorResponse(res, 404, 'not_found');
  if (incident.user_id !== user_id) return errorResponse(res, 403, 'not_owner');
  if (incident.status !== 'AVAILABLE') return errorResponse(res, 409, 'not_available');
  
  db.prepare("UPDATE incidents SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.post('/api/bot/incidents/:id/review', (req: Request, res: Response) => {
  const { user_id, rating, comment } = req.body;
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any;
  if (!incident) return errorResponse(res, 404, 'not_found');
  if (incident.user_id !== user_id) return errorResponse(res, 403, 'not_owner');
  if (incident.status !== 'RESOLVED') return errorResponse(res, 409, 'not_resolved');
  
  const existing = db.prepare('SELECT * FROM reviews WHERE incident_id = ?').get(req.params.id);
  if (existing) return errorResponse(res, 409, 'already_reviewed');
  
  if (!rating || rating < 1 || rating > 5) return errorResponse(res, 400, 'invalid_rating');
  if (comment && comment.length > 300) return errorResponse(res, 400, 'comment_too_long');
  
  const result = db.prepare('INSERT INTO reviews (incident_id, master_id, user_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(req.params.id, incident.master_id, user_id, rating, comment || null);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(review);
});

// ====== MASTERS API ======
app.get('/api/bot/masters', (req: Request, res: Response) => {
  const { worker_type } = req.query;
  let sql = `SELECT u.id, u.name, u.worker_type, 
    ROUND(AVG(r.rating), 2) as rating_avg, 
    COUNT(r.id) as review_count 
    FROM users u LEFT JOIN reviews r ON r.master_id = u.id 
    WHERE u.role = 'master'`;
  const params: any[] = [];
  if (worker_type) { sql += ' AND u.worker_type = ?'; params.push(worker_type); }
  sql += ' GROUP BY u.id ORDER BY u.name';
  const masters = db.prepare(sql).all(...params);
  res.json(masters);
});

// ====== HEALTH ======
app.get('/health', (req: Request, res: Response) => {
  const incidents_count = (db.prepare('SELECT COUNT(*) as c FROM incidents').get() as any).c;
  const users_count = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
  const uploads_count = fs.readdirSync(UPLOADS_DIR).filter(f => !f.startsWith('.')).length;
  res.json({ status: 'ok', database: 'sqlite', incidents_count, users_count, uploads_count, version: 'bot-v2-2026-09-30' });
});
app.get('/api/bot/health', (req: Request, res: Response) => app.get('/health')(req, res));

// ====== MAX WEBHOOK ======
const maxSessions = new Map<string, { step: number; data: any; createdAt: number }>();

async function sendMaxMessage(userId: string, text: string, keyboard?: any) {
  if (!MAX_BOT_TOKEN) {
    console.log(`[MAX MOCK] → ${userId}: ${text}`);
    return;
  }
  try {
    const body: any = { user_id: userId, text };
    if (keyboard) body.keyboard = keyboard;
    await fetch(`https://botapi.max.ru/messages?access_token=${MAX_BOT_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('MAX send error:', e);
  }
}

async function handleMaxMessage(message: any) {
  const userId = message.sender?.user_id;
  if (!userId) return;
  
  const maxUserId = `max_${userId}`;
  const text = message.body?.text || '';
  const attachments = message.attachments || [];
  
  if (!checkRateLimit(`max_${userId}`, 20)) return;
  
  // Check if user exists
  let user = db.prepare('SELECT * FROM users WHERE id = ?').get(maxUserId) as any;
  
  // Session handling for onboarding
  const session = maxSessions.get(maxUserId);
  if (session && Date.now() - session.createdAt < 600000) {
    if (session.step === 1) {
      // Waiting for name
      if (text.length < 1 || text.length > 100) {
        await sendMaxMessage(userId, 'Имя должно быть от 1 до 100 символов. Введите ещё раз:');
        return;
      }
      session.data.name = text;
      if (session.data.role === 'master') {
        session.step = 2;
        await sendMaxMessage(userId, 'Выберите специальность:', {
          inline_keyboard: [[
            { text: '🔧 Сантехник', callback_data: 'spec:PLUMBER' },
            { text: '⚡ Электрик', callback_data: 'spec:ELECTRICIAN' }
          ], [
            { text: '🧹 Уборщик', callback_data: 'spec:CLEANER' },
            { text: '🔑 Слесарь', callback_data: 'spec:LOCKSMITH' }
          ], [
            { text: '🌳 Благоустройство', callback_data: 'spec:LANDSCAPER' },
            { text: '🛠 Обслуживание', callback_data: 'spec:MAINTENANCE' }
          ], [
            { text: '🔨 Универсал', callback_data: 'spec:UNIVERSAL' }
          ]]
        });
      } else {
        session.step = 2;
        await sendMaxMessage(userId, 'Укажите адрес по умолчанию (или /skip):');
      }
      return;
    }
    if (session.step === 2 && session.data.role === 'resident') {
      const address = text === '/skip' ? null : text.slice(0, 200);
      db.prepare('INSERT INTO users (id, role, name, default_address) VALUES (?, ?, ?, ?)').run(maxUserId, 'resident', session.data.name, address);
      maxSessions.delete(maxUserId);
      await sendMaxMessage(userId, `✅ Профиль создан!\nРоль: Житель\nИмя: ${session.data.name}${address ? `\nАдрес: ${address}` : ''}`);
      return;
    }
  }
  
  if (!user) {
    // Start onboarding
    if (text === '/start' || !session) {
      maxSessions.set(maxUserId, { step: 1, data: {}, createdAt: Date.now() });
      await sendMaxMessage(userId, 'Добро пожаловать в Аварийный диспетчер!\n\nКто вы?', {
        inline_keyboard: [[
          { text: '👤 Житель', callback_data: 'role:resident' },
          { text: '🔧 Мастер', callback_data: 'role:master' }
        ]]
      });
      return;
    }
  }
  
  // Commands for known users
  if (text === '/profile' && user) {
    const rating = db.prepare('SELECT ROUND(AVG(rating),2) as avg, COUNT(*) as cnt FROM reviews WHERE master_id = ?').get(user.id) as any;
    let msg = `👤 Профиль\nРоль: ${user.role === 'resident' ? 'Житель' : 'Мастер'}\nИмя: ${user.name}`;
    if (user.worker_type) msg += `\nСпециальность: ${user.worker_type}`;
    if (user.default_address) msg += `\nАдрес: ${user.default_address}`;
    if (user.role === 'master' && rating.avg) msg += `\nРейтинг: ${rating.avg} (${rating.cnt} отзывов)`;
    await sendMaxMessage(userId, msg);
    return;
  }
  
  if (text === '/help') {
    await sendMaxMessage(userId, 'Команды:\n/profile — ваш профиль\n/role — сменить роль\n/help — помощь\n🔗 Веб-версия мини-приложения: https://v3258578.hosted-by-vdsina.ru');
    return;
  }
  
  if (text === '/role' && user) {
    db.prepare('DELETE FROM users WHERE id = ?').run(maxUserId);
    maxSessions.set(maxUserId, { step: 1, data: {}, createdAt: Date.now() });
    await sendMaxMessage(userId, 'Выберите новую роль:', {
      inline_keyboard: [[
        { text: '👤 Житель', callback_data: 'role:resident' },
        { text: '🔧 Мастер', callback_data: 'role:master' }
      ]]
    });
    return;
  }
  
  // Process incident from resident
  if (user && user.role === 'resident' && text) {
    try {
      await sendMaxMessage(userId, '⏳ Анализирую...');
      
      const textResult = await analyzeText(text);
      let photoResult = null;
      
      const photoAtt = attachments.find((a: any) => a.type === 'image' || a.type === 'photo');
      if (photoAtt?.url) {
        try {
          const photoRes = await fetch(photoAtt.url);
          const photoBuffer = Buffer.from(await photoRes.arrayBuffer());
          photoResult = await analyzeImage(photoBuffer, 'photo.jpg');
        } catch (e) {
          console.error('Photo download/analyze error:', e);
        }
      }
      
      const mode = photoResult && text ? 'TEXT_AND_IMAGE' : photoResult ? 'IMAGE_ONLY' : 'TEXT_ONLY';
      const fused = fuseResults(textResult, photoResult, mode);
      
      if (fused.classificationResult === 'NOT_INCIDENT') {
        await sendMaxMessage(userId, '🔍 Не удалось определить проблему. Попробуйте описать подробнее или отправить фото.');
        return;
      }
      
      const address = user.default_address || 'не указан';
      const result = db.prepare(`
        INSERT INTO incidents (user_id, text, address, category, subcategory, severity, confidence, input_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'WEBHOOK')
      `).run(maxUserId, text, address, fused.category, fused.subcategory, fused.severity, fused.confidence);
      
      const cat = fused.category ? TAXONOMY[fused.category] : null;
      const sub = fused.category && fused.subcategory && cat ? cat.subcategories[fused.subcategory] : null;
      
      await sendMaxMessage(userId, `✅ Заявка #${result.lastInsertRowid} создана!\n\nКатегория: ${cat?.name || 'не определена'}${sub ? `\nПодкатегория: ${sub.name}` : ''}\nСрочность: ${fused.severity}\nАдрес: ${address}`);
    } catch (e) {
      console.error('Webhook incident error:', e);
      // Create without classification
      const address = user.default_address || 'не указан';
      const result = db.prepare(`
        INSERT INTO incidents (user_id, text, address, input_mode)
        VALUES (?, ?, ?, 'WEBHOOK')
      `).run(maxUserId, text, address);
      await sendMaxMessage(userId, `✅ Заявка #${result.lastInsertRowid} принята без автоматической классификации. Диспетчер уточнит детали.`);
    }
  }
}

app.post('/webhook', (req: Request, res: Response) => {
  res.json({ ok: true });
  
  setImmediate(async () => {
    try {
      const { update_type, message, callback } = req.body;
      
      if (update_type === 'bot_started' && message?.sender?.user_id) {
        const maxUserId = `max_${message.sender.user_id}`;
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(maxUserId);
        if (user) {
          await sendMaxMessage(message.sender.user_id, `С возвращением, ${(user as any).name}!`);
        } else {
          await handleMaxMessage(message);
        }
        return;
      }
      
      if (update_type === 'message_created' && message) {
        await handleMaxMessage(message);
        return;
      }
      
      if (update_type === 'message_callback' && callback) {
        const userId = callback.user?.id || callback.sender?.user_id;
        if (!userId) return;
        const maxUserId = `max_${userId}`;
        const payload = callback.payload || callback.data || '';
        
        const session = maxSessions.get(maxUserId);
        if (session) {
          if (payload.startsWith('role:')) {
            session.data.role = payload.split(':')[1];
            session.step = 1;
            await sendMaxMessage(userId, 'Как вас зовут?');
            return;
          }
          if (payload.startsWith('spec:') && session.data.role === 'master') {
            const worker_type = payload.split(':')[1];
            db.prepare('INSERT INTO users (id, role, name, worker_type) VALUES (?, ?, ?, ?)').run(maxUserId, 'master', session.data.name, worker_type);
            maxSessions.delete(maxUserId);
            await sendMaxMessage(userId, `✅ Профиль создан!\nРоль: Мастер\nИмя: ${session.data.name}\nСпециальность: ${worker_type}`);
            return;
          }
        }
        
        // Review callback
        const reviewMatch = payload.match(/^review:(\d+):(\d)$/);
        if (reviewMatch) {
          const incidentId = parseInt(reviewMatch[1]);
          const rating = parseInt(reviewMatch[2]);
          const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId) as any;
          if (!incident || incident.user_id !== maxUserId) return;
          if (incident.status !== 'RESOLVED') return;
          const existing = db.prepare('SELECT * FROM reviews WHERE incident_id = ?').get(incidentId);
          if (existing) {
            await sendMaxMessage(userId, 'Вы уже оценили эту заявку.');
            return;
          }
          db.prepare('INSERT INTO reviews (incident_id, master_id, user_id, rating) VALUES (?, ?, ?, ?)').run(incidentId, incident.master_id, maxUserId, rating);
          await sendMaxMessage(userId, `Спасибо за оценку! Вы поставили ${rating}⭐`);
        }
      }
    } catch (e) {
      console.error('Webhook handler error:', e);
    }
  });
});

// ====== ERROR HANDLER ======
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'internal_error' });
});

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

// ====== MAX WEBHOOK REGISTRATION ======
async function registerWebhook() {
  if (!MAX_BOT_TOKEN || !WEBHOOK_URL) return;
  try {
    await fetch(`https://botapi.max.ru/subscriptions?access_token=${MAX_BOT_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        update_types: ['message_created', 'bot_started', 'message_callback']
      })
    });
    console.log('✅ Webhook registered');
  } catch (e) {
    console.error('Webhook registration failed, retrying in 60s:', e);
    setTimeout(registerWebhook, 60000);
  }
}

// ====== START ======
app.listen(PORT, () => {
  console.log(`🤖 Bot server running on port ${PORT}`);
  console.log(`📡 AI API: ${AI_API_URL}`);
  console.log(`💾 SQLite: ${DB_PATH}`);
  registerWebhook();
});
