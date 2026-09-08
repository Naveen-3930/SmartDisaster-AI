// routes/incidents.js
const express = require('express');
const db = require('../db');
const { verifyToken, requireRole, requireAnyRole } = require('../middleware');

const router = express.Router();

const VALID_STATUSES = ['REPORTED', 'VERIFIED', 'ASSIGNED', 'RESPONSE_STARTED', 'RESOLVED', 'CLOSED'];

// User reports an incident
router.post('/', verifyToken, (req, res) => {
  const { disaster_type, location, severity, description } = req.body;
  if (!disaster_type || !location) {
    return res.status(400).json({ error: 'disaster_type and location are required' });
  }
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO incidents (disaster_type, location, severity, description, reported_by, status, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).run(disaster_type, location, severity || 'MEDIUM', description || '', req.user.id, 'REPORTED', now);

  res.status(201).json({ message: 'Incident reported', id: result.lastInsertRowid });
});

// Get all incidents (optionally filter by status, disaster_type, or location)
router.get('/', verifyToken, (req, res) => {
  const { status, disaster_type, location } = req.query;

  let query = 'SELECT * FROM incidents WHERE 1=1';
  const params = [];

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    query += ' AND status = ?';
    params.push(status);
  }
  if (disaster_type) {
    query += ' AND disaster_type = ?';
    params.push(disaster_type);
  }
  if (location) {
    query += ' AND location LIKE ?';
    params.push(`%${location}%`);
  }

  query += ' ORDER BY created_at DESC';

  const incidents = db.prepare(query).all(...params);
  res.status(200).json({ incidents });
});

// Get a single incident by id
router.get('/:id', verifyToken, (req, res) => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }
  res.status(200).json({ incident });
});

// Update incident status (admin only) — e.g. VERIFIED, ASSIGNED, RESPONSE_STARTED, RESOLVED, CLOSED
router.patch('/:id/status', verifyToken, requireAnyRole(['ADMIN','RESPONDER']), (req, res) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  db.prepare('UPDATE incidents SET status = ? WHERE id = ?').run(status, req.params.id);

  res.status(200).json({ message: 'Status updated', id: req.params.id, status });
});

// Assign an incident to a response team (admin only)
router.patch('/:id/assign', verifyToken, requireAnyRole(['ADMIN','RESPONDER']), (req, res) => {
  const { assigned_team } = req.body;

  if (!assigned_team) {
    return res.status(400).json({ error: 'assigned_team is required' });
  }

  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  db.prepare('UPDATE incidents SET assigned_team = ?, status = ? WHERE id = ?')
    .run(assigned_team, 'ASSIGNED', req.params.id);

  res.status(200).json({ message: 'Incident assigned', id: req.params.id, assigned_team });
});

// Resolve/close an incident with a resolution note (admin only)
router.patch('/:id/resolve', verifyToken, requireAnyRole(['ADMIN','RESPONDER']), (req, res) => {
  const { resolution } = req.body;

  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  db.prepare('UPDATE incidents SET status = ?, resolution = ? WHERE id = ?')
    .run('RESOLVED', resolution || '', req.params.id);

  res.status(200).json({ message: 'Incident resolved', id: req.params.id });
});

// Get notes/comments for an incident (staff only)
router.get('/:id/notes', verifyToken, requireAnyRole(['ADMIN','RESPONDER']), (req, res) => {
  const incident = db.prepare('SELECT id FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const notes = db.prepare(`
    SELECT incident_notes.id, incident_notes.note, incident_notes.created_at,
           users.name AS author_name, users.role AS author_role
    FROM incident_notes
    JOIN users ON users.id = incident_notes.user_id
    WHERE incident_notes.incident_id = ?
    ORDER BY incident_notes.created_at ASC
  `).all(req.params.id);

  res.status(200).json({ notes });
});

// Add a note/comment to an incident (staff only)
router.post('/:id/notes', verifyToken, requireAnyRole(['ADMIN','RESPONDER']), (req, res) => {
  const { note } = req.body;
  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'note is required' });
  }

  const incident = db.prepare('SELECT id FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO incident_notes (incident_id, user_id, note, created_at) VALUES (?,?,?,?)
  `).run(req.params.id, req.user.id, note.trim(), now);

  res.status(201).json({ message: 'Note added', id: result.lastInsertRowid });
});

// Delete an incident (admin only)
router.delete('/:id', verifyToken, requireRole('ADMIN'), (req, res) => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id);
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  db.prepare('DELETE FROM incidents WHERE id = ?').run(req.params.id);
  res.status(200).json({ message: 'Incident deleted', id: req.params.id });
});

module.exports = router;
