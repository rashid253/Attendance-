// File: functions/index.js

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const cors      = require('cors');

// Initialize Firebase Admin
admin.initializeApp();

// Configure CORS middleware explicitly
// یہاں origin: '*' کر دیا ہے تاکہ ہر جگہ سے آنے والی ریکویسٹ قبول ہو
// اگر صرف آپ کی GitHub Pages ڈومین allow کرنی ہو تو یہاں 'https://rashid253.github.io' لکھ دیں
const corsHandler = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

/**
 * Utility: Verify that the incoming request carries a valid Firebase ID Token
 *            with an 'admin' role claim. اگر verify یا role mismatch ہو تو 
 *            مناسب HTTP status واپس کریں گے اور null لوٹائیں گے۔
 */
async function verifyAdmin(req, res) {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : null;

  if (!idToken) {
    // No token کی صورت میں 401 واپس کریں
    res.set('Access-Control-Allow-Origin', '*');
    res.status(401).json({ error: 'Unauthorized: No ID token provided' });
    return null;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.role !== 'admin') {
      // اگر role 'admin' نہ ہو تو 403 واپس کریں
      res.set('Access-Control-Allow-Origin', '*');
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return null;
    }
    return decoded;
  } catch (error) {
    // اگر ٹوکن invalid ہو تو 401 واپس کریں
    res.set('Access-Control-Allow-Origin', '*');
    res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
    return null;
  }
}

/**
 * 1) Set Custom Claim (role) for a user
 * ------------------------------------------------
 *   - HTTP Method: POST
 *   - URL: https://<region>-<project>.cloudfunctions.net/setCustomClaim
 *   - Body: { "uid": "<USER_UID>", "role": "<ROLE_STRING>" }
 *   - Header: Authorization: Bearer <Firebase_ID_Token_of_admin_user>
 */
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    // سب سے پہلے CORS middleware کال کریں
    corsHandler(req, res, async () => {
      // اگر request کا method OPTIONS ہو تو status 204 واپس کریں
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(204).send('');
      }

      // صرف POST method allow کریں
      if (req.method !== 'POST') {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      // Authorization اور admin role verify کریں
      const decoded = await verifyAdmin(req, res);
      if (!decoded) {
        // اگر verifyAdmin نے ہی جواب بھیج دیا ہے یا null لوٹا دیا ہے، صرف ریٹرن کریں
        return;
      }

      // Body سے uid اور role نکالیں
      const { uid, role } = req.body;
      if (!uid || !role) {
        res.set('Access-Control-Allow-Origin', '*');
        return res.status(400).json({ error: 'Missing uid or role in request body' });
      }

      try {
        // Firebase Admin SDK کے ذریعے custom claim سیٹ کریں
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

/**
 * 2) Delete User by UID
 * ------------------------------------------------
 *   - HTTP Method: POST
 *   - URL: https://<region>-<project>.cloudfunctions.net/deleteUser
 *   - Body: { "uid": "<USER_UID>" }
 *   - Header: Authorization: Bearer <Firebase_ID_Token_of_admin_user>
 */
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

      // Authorization اور admin role verify کریں
      const decoded = await verifyAdmin(req, res);
      if (!decoded) {
        return;
      }

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
