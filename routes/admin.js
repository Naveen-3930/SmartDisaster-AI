const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware');

const router = express.Router();

router.get('/stats', verifyToken, requireRole('ADMIN'), (req, res) => {
  const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  const active_alerts = db.prepare("SELECT COUNT(*) c FROM alerts WHERE status='ACTIVE'").get().c;
  const critical_incidents = db.prepare(
    "SELECT COUNT(*) c FROM incidents WHERE severity IN ('HIGH','CRITICAL') AND status NOT IN ('RESOLVED','CLOSED')"
  ).get().c;
  const pending_sos = db.prepare("SELECT COUNT(*) c FROM sos_requests WHERE status != 'RESOLVED'").get().c;
  const shelters = db.prepare('SELECT COUNT(*) c FROM shelters').get().c;

  res.json({ users, active_alerts, critical_incidents, pending_sos, shelters });
});

// List all users (admin only)
router.get('/users', verifyToken, requireRole('ADMIN'), (req, res) => {
  const users = db.prepare('SELECT id, name, email, phone, role, location, created_at FROM users ORDER BY id').all();
  res.json({ users });
});

// Change a user's role (admin only)
router.patch('/users/:id/role', verifyToken, requireRole('ADMIN'), (req, res) => {
  const { role } = req.body;
  const validRoles = ['USER', 'RESPONDER', 'ADMIN'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Role updated', id: req.params.id, role });
});

router.get('/risk-trend', verifyToken, requireRole('ADMIN'), (req, res) => {
  const rows = db.prepare('SELECT overall_score, created_at FROM predictions ORDER BY id DESC LIMIT 15').all();
  res.json(rows.reverse());
});

module.exports = router;