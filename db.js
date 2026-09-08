// db.js
const Database = require('better-sqlite3');
const db = new Database('smartdisaster.db');
const bcrypt = require('bcryptjs');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'USER',
  location TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  rainfall REAL, water_level REAL, temperature REAL,
  humidity REAL, smoke REAL,
  flood_score REAL, fire_score REAL, heat_score REAL,
  overall_score REAL, risk_level TEXT, primary_hazard TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT, severity TEXT, message TEXT,
  location TEXT, risk_score REAL,
  status TEXT DEFAULT 'ACTIVE',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS shelters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, address TEXT,
  latitude REAL, longitude REAL,
  capacity INTEGER, occupied INTEGER,
  status TEXT, contact TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, department TEXT, phone TEXT, location TEXT
);

CREATE TABLE IF NOT EXISTS sos_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, name TEXT, phone TEXT,
  latitude REAL, longitude REAL,
  emergency_type TEXT, message TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  disaster_type TEXT,
  location TEXT,
  severity TEXT,
  description TEXT,
  reported_by INTEGER,
  assigned_team TEXT,
  status TEXT DEFAULT 'REPORTED',
  resolution TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS incident_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT
);
`);

// Seed only if empty
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const now = new Date().toISOString();
  const insertUser = db.prepare(
    `INSERT INTO users (name,email,password,phone,role,location,created_at) VALUES (?,?,?,?,?,?,?)`
  );
  insertUser.run('Admin', 'admin@smartdisaster.ai', bcrypt.hashSync('admin123', 10), '9999999999', 'ADMIN', 'Hyderabad', now);
  insertUser.run('Demo User', 'user@smartdisaster.ai', bcrypt.hashSync('user123', 10), '8888888888', 'USER', 'Hyderabad', now);

  const insertShelter = db.prepare(
    `INSERT INTO shelters (name,address,latitude,longitude,capacity,occupied,status,contact) VALUES (?,?,?,?,?,?,?,?)`
  );
  insertShelter.run('Government Relief Center', 'Tank Bund Road', 17.4239, 78.4738, 500, 280, 'AVAILABLE', '040-1111111');
  insertShelter.run('Community Hall Shelter', 'Kukatpally', 17.4849, 78.4138, 250, 240, 'LIMITED', '040-2222222');
  insertShelter.run('Municipal Sports Complex', 'Gachibowli', 17.4401, 78.3489, 400, 90, 'AVAILABLE', '040-4444444');

  const insertContact = db.prepare(
    `INSERT INTO contacts (name,department,phone,location) VALUES (?,?,?,?)`
  );
  insertContact.run('City Police Control Room', 'Police', '100', 'Hyderabad');
  insertContact.run('Fire Department', 'Fire', '101', 'Hyderabad');
  insertContact.run('Ambulance Service', 'Ambulance', '108', 'Hyderabad');

  console.log('Seed data inserted.');
}

module.exports = db;