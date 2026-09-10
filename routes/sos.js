const express = require('express');
const db = require('../db');
const { verifyToken, requireAnyRole } = require('../middleware');

const router = express.Router();

const SOS_STATUSES = ['PENDING', 'ACKNOWLEDGED', 'EN_ROUTE', 'SAFE'];

// User creates an SOS request
router.post('/', verifyToken, (req, res) => {
  const { latitude, longitude, emergency_type = 'General', message = '', phone = '' } = req.body;
  const now = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO sos_requests (user_id,name,phone,latitude,longitude,emergency_type,message,status,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(req.user.id, req.user.name, phone, latitude, longitude, emergency_type, message, 'PENDING', now);

  res.status(201).json({ message: 'SOS request received', id: result.lastInsertRowid });
});

// Staff (admin or responder) views all SOS requests
router.get('/', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
  const sos = db.prepare(`
    SELECT *, latitude AS lat, longitude AS lng
    FROM sos_requests
    ORDER BY id DESC
  `).all();
  res.json({ sos });
});

// Staff (admin or responder) updates SOS status — used by responder.html
router.patch('/:id/status', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
  const { status } = req.body;
  if (!status || !SOS_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${SOS_STATUSES.join(', ')}` });
  }
  const sosRequest = db.prepare('SELECT id FROM sos_requests WHERE id = ?').get(req.params.id);
  if (!sosRequest) {
    return res.status(404).json({ error: 'SOS request not found' });
  }
  db.prepare('UPDATE sos_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated', id: req.params.id, status });
});

// Legacy route kept for backward compatibility with any existing callers
router.put('/:id', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
  const { status } = req.body;
  const legacyValid = ['PENDING', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED'];
  if (!legacyValid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE sos_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated' });
});

module.exports = router;