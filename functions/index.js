// File: functions/index.js
const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

// Utility to send CORS headers
function enableCors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// 1) set setCustomClaim
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    enableCors(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;
    if (!idToken) {
      return res.status(401).send('Unauthorized');
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).send('Invalid token');
    }
    if (decoded.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }

    const { uid, role } = req.body;
    if (!uid || !role) {
      return res.status(400).send('Missing uid or role');
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { role });
      return res.json({ success: true });
    } catch (err) {
      console.error('Error setting claim', err);
      return res.status(500).send('Internal error');
    }
  });

// 2) deleteUser
exports.deleteUser = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    enableCors(req, res);
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1]
      : null;
    if (!idToken) {
      return res.status(401).send('Unauthorized');
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).send('Invalid token');
    }
    if (decoded.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }

    const { uid } = req.body;
    if (!uid) {
      return res.status(400).send('Missing uid');
    }

    try {
      await admin.auth().deleteUser(uid);
      return res.json({ success: true });
    } catch (err) {
      console.error('Error deleting user', err);
      return res.status(500).send('Internal error');
    }
  });
