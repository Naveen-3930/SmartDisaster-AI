// routes/prediction.js
const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware');
const { computeRisk } = require('../riskEngine');

const router = express.Router();

function validateInputs({ rainfall, water_level, temperature, humidity, smoke }) {
  const errors = [];
  if (temperature < -50 || temperature > 60) errors.push('Temperature must be between -50°C and 60°C');
  if (humidity < 0 || humidity > 100) errors.push('Humidity must be between 0% and 100%');
  if (water_level < 0 || water_level > 100) errors.push('Water level must be between 0% and 100%');
  if (smoke < 0 || smoke > 100) errors.push('Smoke level must be between 0% and 100%');
  if (rainfall < 0 || rainfall > 500) errors.push('Rainfall must be between 0mm and 500mm');
  return errors;
}

// Fetch live temperature & humidity for a location from OpenWeatherMap
router.get('/weather', verifyToken, async (req, res) => {
  const lat = +req.query.lat;
  const lon = +req.query.lon;

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params are required' });
  }
  if (!process.env.OPENWEATHER_API_KEY) {
    return res.status(500).json({ error: 'Weather is not configured on the server (missing API key)' });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('OpenWeatherMap error:', data);
      return res.status(502).json({ error: data.message || 'Weather service error' });
    }

    res.json({
      temperature: Math.round(data.main.temp),
      humidity: Math.round(data.main.humidity),
      location_name: data.name || null,
    });
  } catch (err) {
    console.error('Weather request failed:', err);
    res.status(500).json({ error: 'Failed to reach weather service' });
  }
});

router.post('/', verifyToken, (req, res) => {
  const rainfall = +req.body.rainfall;
  const water_level = +req.body.water_level;
  const temperature = +req.body.temperature;
  const humidity = +req.body.humidity;
  const smoke = +req.body.smoke;

  if ([rainfall, water_level, temperature, humidity, smoke].some(Number.isNaN)) {
    return res.status(400).json({ error: 'All fields must be valid numbers' });
  }

  const errors = validateInputs({ rainfall, water_level, temperature, humidity, smoke });
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  const result = computeRisk({ rainfall, water_level, temperature, humidity, smoke });
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO predictions
      (user_id,rainfall,water_level,temperature,humidity,smoke,
       flood_score,fire_score,heat_score,overall_score,risk_level,primary_hazard,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.user.id, rainfall, water_level, temperature, humidity, smoke,
    result.flood_score, result.fire_score, result.heat_score,
    result.overall_score, result.risk_level, result.primary_hazard, now
  );

  if (result.risk_level === 'HIGH' || result.risk_level === 'CRITICAL') {
    const currentUser = db.prepare('SELECT location FROM users WHERE id = ?').get(req.user.id);
    const alertLocation = currentUser?.location || 'Unknown';

    const message = `🚨 ${result.risk_level} ${result.primary_hazard} ALERT - ${result.recommended_action}`;
    db.prepare(`
      INSERT INTO alerts (type,severity,message,location,risk_score,status,created_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(result.primary_hazard, result.risk_level, message, alertLocation, result.overall_score, 'ACTIVE', now);
  }

  res.json(result);
});

router.get('/history', verifyToken, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM predictions WHERE user_id = ? ORDER BY id DESC LIMIT 20'
  ).all(req.user.id);
  res.json(rows.reverse());
});

module.exports = router;