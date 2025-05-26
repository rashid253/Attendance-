// Force Firebase Functions to treat code as v1
// اگر CLI confuse ہو تو یہ لائن مدد کرے گی
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'attandace-management';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const cors      = require('cors');

admin.initializeApp();

const corsHandler = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

async function verifyAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : null;

  if (!idToken) {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(401).json({ error: 'Unauthorized: No ID token provided' });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.role !== 'admin') {
      res.set('Access-Control-Allow-Origin', '*');
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return null;
    }
    return decoded;
  } catch (error) {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
    return null;
  }
}

// 1) Set Custom Claim
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(204).send('');
      }

      if (req.method !== 'POST') {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const decoded = await verifyAdmin(req, res);
      if (!decoded) return;

      const { uid, role } = req.body;
      if (!uid || !role) {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(400).json({ error: 'Missing uid or role in request body' });
      }

      try {
        await admin.auth().setCustomUserClaims(uid, { role });
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Error setting custom claim:', err);
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  });

// 2) Delete User
exports.deleteUser = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(204).send('');
      }

      if (req.method !== 'POST') {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const decoded = await verifyAdmin(req, res);
      if (!decoded) return;

      const { uid } = req.body;
      if (!uid) {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(400).json({ error: 'Missing uid in request body' });
      }

      try {
        await admin.auth().deleteUser(uid);
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Error deleting user:', err);
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  });
