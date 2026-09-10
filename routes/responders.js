// routes/responders.js
const express = require('express');
const db = require('../db');
const { verifyToken, requireAnyRole } = require('../middleware');

const router = express.Router();

// Responder/Admin pushes their own live location
router.patch('/me/location', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const { lat, lng } = req.body;

    if (lat == null || lng == null || isNaN(Number(lat)) || isNaN(Number(lng))) {
        return res.status(400).json({ error: 'lat and lng are required numbers' });
    }

    const now = new Date().toISOString();

    db.prepare(`
    INSERT INTO responder_locations (user_id, latitude, longitude, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET latitude = ?, longitude = ?, updated_at = ?
  `).run(req.user.id, Number(lat), Number(lng), now, Number(lat), Number(lng), now);

    res.status(200).json({ message: 'Location updated' });
});

// Staff view: all responders' latest known locations
router.get('/locations', verifyToken, requireAnyRole(['ADMIN', 'RESPONDER']), (req, res) => {
    const responders = db.prepare(`
    SELECT users.id, users.name,
           responder_locations.latitude AS lat,
           responder_locations.longitude AS lng,
           responder_locations.updated_at
    FROM responder_locations
    JOIN users ON users.id = responder_locations.user_id
    ORDER BY responder_locations.updated_at DESC
  `).all();

    res.status(200).json({ responders });
});

module.exports = router;