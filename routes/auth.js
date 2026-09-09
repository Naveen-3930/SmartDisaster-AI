// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 attempts per IP per window
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', (req, res) => {
  const { name, email, password, phone, location } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hashed = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (name,email,password,phone,role,location,created_at) VALUES (?,?,?,?,?,?,?)`
  ).run(name, email, hashed, phone || '', 'USER', location || '', now);

  res.status(201).json({ message: 'Registration successful' });
});

router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, role: user.role, email: user.email },
  });
});

module.exports = router;