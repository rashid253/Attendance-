// File: functions/index.js

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const cors      = require('cors');

// Initialize Firebase Admin
admin.initializeApp();

// Configure CORS middleware to allow all origins (یا مخصوص origin اگر چاہیں تو یہاں بدل دیں)
const corsHandler = cors({
  origin: true, // true کا مطلب ہے: کوئی بھی origin allow ہے۔ اگر صرف آپ کے GitHub Pages کی ڈومین allow کرنی ہو تو: ['https://rashid253.github.io']
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

/**
 * Utility: Verify that incoming request carries a valid Firebase ID Token
 *             with an 'admin' role claim. اگر verify یا role mismatch ہو تو 
 *             مناسب HTTP status واپس کریں گے۔
 */
async function verifyAdmin(req, res) {
  // Authorization header سے Bearer token نکالیں
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ')
    ? authHeader.split('Bearer ')[1]
    : null;

  if (!idToken) {
    res.status(401).json({ error: 'Unauthorized: No ID token provided' });
    return null;
  }

  try {
    // ID ٹوکن verify کریں
    const decoded = await admin.auth().verifyIdToken(idToken);
    // user کے custom claims میں role چیک کریں
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return null;
    }
    // اگر سب ٹھیک ہے، تو decoded واپس کر دیں (اگر ضرورت ہو)
    return decoded;
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid ID token' });
    return null;
  }
}

/**
 * 1) Set Custom Claim (role) for a user
 * ------------------------------------------------
 *   - Route:   POST https://<region>-<project>.cloudfunctions.net/setCustomClaim
 *   - Body:    { "uid": "<USER_UID>", "role": "<ROLE_STRING>" }
 *   - Header:  Authorization: Bearer <Firebase_ID_Token_of_admin_user>
 *
 * یہ فنکشن CORS کو ہینڈل کرتا ہے، پہلے preflight check دیکھتا ہے،
 * پھر ID ٹوکن verify کر کے صرف ’admin‘ role والے یوزر کو آگے بڑھنے دیتا ہے،
 * اور آخر میں `setCustomUserClaims` کال کر کے یوزر کے ساتھ role کو attach کر دیتا ہے۔
 */
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    // CORS handling
    corsHandler(req, res, async () => {
      // preflight request (OPTIONS) ہو تو 204 No Content واپس کریں
      if (req.method === 'OPTIONS') {
        return res.status(204).send('');
      }

      // صرف POST میتھڈ allow کریں
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      // ID ٹوکن اور role/uid verify کرنا
      const decoded = await verifyAdmin(req, res);
      if (!decoded) {
        // اگر verifyAdmin نے جواب already بھیج دیا ہو، بس واپس آجائیں
        return;
      }

      // request body سے uid اور role نکالیں
      const { uid, role } = req.body;
      if (!uid || !role) {
        return res.status(400).json({ error: 'Missing uid or role in request body' });
      }

      try {
        // Firebase Admin SDK سے custom claim سیٹ کریں
        await admin.auth().setCustomUserClaims(uid, { role });
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Error setting custom claim:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  });

/**
 * 2) Delete User by UID
 * ------------------------------------------------
 *   - Route:   POST https://<region>-<project>.cloudfunctions.net/deleteUser
 *   - Body:    { "uid": "<USER_UID>" }
 *   - Header:  Authorization: Bearer <Firebase_ID_Token_of_admin_user>
 *
 * یہ فنکشن بھی CORS کو ہیڈ کرتا ہے، پھر صرف ’admin‘ role والے یوزر کو
 * deleteUser کال کی اجازت دیتا ہے۔ UID ملا تو اس یوزر کو Firebase Auth سے حذف کر دیتا ہے۔
 */
exports.deleteUser = functions
  .region('asia-south1')
  .https.onRequest(async (req, res) => {
    // CORS handling
    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        return res.status(204).send('');
      }
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      // verifyAdmin کی مدد سے ID ٹوکن اور ’admin‘ رول چیک کریں
      const decoded = await verifyAdmin(req, res);
      if (!decoded) {
        return;
      }

      const { uid } = req.body;
      if (!uid) {
        return res.status(400).json({ error: 'Missing uid in request body' });
      }

      try {
        await admin.auth().deleteUser(uid);
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Error deleting user:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  });
