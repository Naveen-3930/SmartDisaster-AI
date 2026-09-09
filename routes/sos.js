const express = require('express');
const db = require('../db');
const { verifyToken, requireAnyRole } = require('../middleware');

const router = express.Router();

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
  const rows = db.prepare('SELECT * FROM sos_requests ORDER BY id DESC').all();
  res.json(rows);
});

// Staff (admin or responder) updates SOS status
router.put('/:id', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
  const { status } = req.body;
  const valid = ['PENDING', 'ACKNOWLEDGED', 'RESPONDING', 'RESOLVED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE sos_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated' });
});

module.exports = router;