const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  const rows = db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT 20').all();
  res.json(rows);
});

module.exports = router;