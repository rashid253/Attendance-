// functions/index.js
// -------------------------------------------
// HTTP‐triggered Functions with CORS for fetch()

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'attandace-management';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const cors      = require('cors')();

// Initialize Admin SDK
admin.initializeApp();

// Common middleware to verify Bearer token + admin role
async function verifyAdmin(req, res) {
  const authHeader = req.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : null;

  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized: No ID token' });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Not an admin' });
      return null;
    }
    return decoded;
  } catch (e) {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return null;
  }
}

// 1) Set Custom Claim
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      if (req.method !== 'POST') return res.sendStatus(405);

      const decoded = await verifyAdmin(req, res);
      if (!decoded) return;

      const { uid, role } = req.body;
      if (!uid || !role) {
        return res.status(400).json({ error: 'Missing uid or role' });
      }

      try {
        await admin.auth().setCustomUserClaims(uid, { role });
        return res.json({ success: true });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
      }
    });
  });

// 2) Delete User
exports.deleteUser = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method === 'OPTIONS') return res.sendStatus(204);
      if (req.method !== 'POST') return res.sendStatus(405);

      const decoded = await verifyAdmin(req, res);
      if (!decoded) return;

      const { uid } = req.body;
      if (!uid) {
        return res.status(400).json({ error: 'Missing uid' });
      }

      try {
        await admin.auth().deleteUser(uid);
        return res.json({ success: true });
      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
      }
    });
  });
