require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const authRoutes = require('./routes/auth');
const predictionRoutes = require('./routes/prediction');
const alertRoutes = require('./routes/alerts');
const shelterRoutes = require('./routes/shelters');
const contactRoutes = require('./routes/contacts');
const sosRoutes = require('./routes/sos');
const adminRoutes = require('./routes/admin');
const incidentRoutes = require('./routes/incidents');
const missingPersonsRoutes = require('./routes/missingPersons');
const chatRoutes = require('./routes/chat');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/prediction', predictionRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/missing-persons', missingPersonsRoutes);
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`SmartDisaster AI running on https://smartdisaster.onrender.com`));