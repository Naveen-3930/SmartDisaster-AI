// routes/missingPersons.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { verifyToken, requireAnyRole } = require('../middleware');

const router = express.Router();

// ---- Photo upload setup ----
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'missing');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `mp_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
    },
});

function imageFilter(req, file, cb) {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
        return cb(new Error('Only JPG, PNG, or WEBP images are allowed'));
    }
    cb(null, true);
}

const upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ---- Report a missing or found person (public — no login required) ----
router.post('/', upload.single('photo'), (req, res) => {
    const { report_type, name, approx_age, gender, description, last_seen_location, reporter_name, reporter_contact } = req.body;

    if (!['MISSING', 'FOUND'].includes(report_type)) {
        return res.status(400).json({ error: "report_type must be 'MISSING' or 'FOUND'" });
    }
    if (!reporter_name || !reporter_contact) {
        return res.status(400).json({ error: 'reporter_name and reporter_contact are required, so staff can follow up with you' });
    }

    const photo_path = req.file ? `/uploads/missing/${req.file.filename}` : null;
    const now = new Date().toISOString();

    let reported_by = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
            reported_by = decoded.id;
        } catch (e) { /* not logged in or invalid token — still allowed, stays anonymous */ }
    }

    const result = db.prepare(`
    INSERT INTO missing_persons
      (report_type, name, approx_age, gender, description, last_seen_location, photo_path, reporter_name, reporter_contact, reported_by, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
        report_type, name || null, approx_age ? +approx_age : null, gender || null, description || null,
        last_seen_location || null, photo_path, reporter_name, reporter_contact, reported_by, 'OPEN', now
    );

    res.status(201).json({ message: 'Report submitted', id: result.lastInsertRowid, photo_path });
});

// ---- List / search reports (public) ----
router.get('/', (req, res) => {
    const { report_type, gender, status, q } = req.query;
    let query = 'SELECT * FROM missing_persons WHERE 1=1';
    const params = [];

    if (report_type) {
        if (!['MISSING', 'FOUND'].includes(report_type)) {
            return res.status(400).json({ error: "report_type must be 'MISSING' or 'FOUND'" });
        }
        query += ' AND report_type = ?';
        params.push(report_type);
    }
    if (gender) { query += ' AND gender = ?'; params.push(gender); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (q) {
        query += ' AND (name LIKE ? OR description LIKE ? OR last_seen_location LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    query += ' ORDER BY created_at DESC';
    const reports = db.prepare(query).all(...params);
    res.status(200).json({ reports });
});

// ---- Get a single report (public) ----
router.get('/:id', (req, res) => {
    const report = db.prepare('SELECT * FROM missing_persons WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.status(200).json({ report });
});

// ---- Suggest candidate matches for a report (staff only) ----
// Basic demographic matching — NOT facial recognition. Every result requires human review.
router.get('/:id/candidates', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const report = db.prepare('SELECT * FROM missing_persons WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const oppositeType = report.report_type === 'MISSING' ? 'FOUND' : 'MISSING';
    let query = "SELECT * FROM missing_persons WHERE report_type = ? AND status = 'OPEN' AND id != ?";
    const params = [oppositeType, report.id];

    if (report.gender) { query += ' AND (gender = ? OR gender IS NULL)'; params.push(report.gender); }
    if (report.approx_age) {
        query += ' AND (approx_age IS NULL OR ABS(approx_age - ?) <= 5)';
        params.push(report.approx_age);
    }

    const candidates = db.prepare(query).all(...params);
    res.status(200).json({ candidates, note: 'These are possible matches based on basic demographic similarity. A staff member must visually confirm before marking as reunited.' });
});

// ---- Propose a match between two reports (staff only) ----
router.post('/:id/match/:targetId', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const a = db.prepare('SELECT * FROM missing_persons WHERE id = ?').get(req.params.id);
    const b = db.prepare('SELECT * FROM missing_persons WHERE id = ?').get(req.params.targetId);
    if (!a || !b) return res.status(404).json({ error: 'One or both reports not found' });
    if (a.report_type === b.report_type) {
        return res.status(400).json({ error: 'Matches must be between one MISSING and one FOUND report' });
    }

    const missing_id = a.report_type === 'MISSING' ? a.id : b.id;
    const found_id = a.report_type === 'FOUND' ? a.id : b.id;
    const now = new Date().toISOString();

    const result = db.prepare(`
    INSERT INTO missing_person_matches (missing_id, found_id, status, created_at) VALUES (?,?,?,?)
  `).run(missing_id, found_id, 'PENDING', now);

    db.prepare("UPDATE missing_persons SET status = 'POTENTIAL_MATCH' WHERE id IN (?,?)").run(missing_id, found_id);

    res.status(201).json({ message: 'Match proposed — pending staff confirmation', id: result.lastInsertRowid });
});

// ---- List pending matches (staff only) ----
router.get('/matches/pending', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const matches = db.prepare(`
    SELECT missing_person_matches.*,
      m.name AS missing_name, m.photo_path AS missing_photo, m.description AS missing_description,
      f.name AS found_name, f.photo_path AS found_photo, f.description AS found_description
    FROM missing_person_matches
    JOIN missing_persons m ON m.id = missing_person_matches.missing_id
    JOIN missing_persons f ON f.id = missing_person_matches.found_id
    WHERE missing_person_matches.status = 'PENDING'
    ORDER BY missing_person_matches.created_at DESC
  `).all();
    res.status(200).json({ matches });
});

// ---- Confirm or reject a proposed match (staff only) ----
router.patch('/matches/:matchId', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const { decision } = req.body; // 'CONFIRMED' or 'REJECTED'
    if (!['CONFIRMED', 'REJECTED'].includes(decision)) {
        return res.status(400).json({ error: "decision must be 'CONFIRMED' or 'REJECTED'" });
    }

    const match = db.prepare('SELECT * FROM missing_person_matches WHERE id = ?').get(req.params.matchId);
    if (!match) return res.status(404).json({ error: 'Match not found' });

    db.prepare('UPDATE missing_person_matches SET status = ?, reviewed_by = ? WHERE id = ?')
        .run(decision, req.user.id, req.params.matchId);

    if (decision === 'CONFIRMED') {
        db.prepare("UPDATE missing_persons SET status = 'REUNITED' WHERE id IN (?,?)")
            .run(match.missing_id, match.found_id);
    } else {
        db.prepare("UPDATE missing_persons SET status = 'OPEN' WHERE id IN (?,?)")
            .run(match.missing_id, match.found_id);
    }

    res.status(200).json({ message: `Match ${decision.toLowerCase()}`, id: req.params.matchId });
});

// ---- Close/remove a false or resolved report (staff only) ----
router.delete('/:id', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const report = db.prepare('SELECT * FROM missing_persons WHERE id = ?').get(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    db.prepare('DELETE FROM missing_persons WHERE id = ?').run(req.params.id);
    res.status(200).json({ message: 'Report removed', id: req.params.id });
});

module.exports = router;