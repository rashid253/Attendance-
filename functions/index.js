// File: functions/index.js

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const cors      = require('cors')({ origin: true });

admin.initializeApp();

// 1) HTTPS function: set custom role claims
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      // Authenticate caller
      const authHeader = req.headers.authorization || '';
      const idToken    = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
      if (!idToken) return res.status(401).send('Unauthorized');
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (err) {
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
        console.error('Error setting custom claim:', err);
        return res.status(500).send('Internal error');
      }
    });
  });

// 2) HTTPS function: delete user account
exports.deleteUser = functions
  .region('asia-south1')
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
      }
      // Authenticate caller
      const authHeader = req.headers.authorization || '';
      const idToken    = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;
      if (!idToken) return res.status(401).send('Unauthorized');
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (err) {
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
        console.error('Error deleting user:', err);
        return res.status(500).send('Internal error');
      }
    });
  });

// 3) Realtime Database trigger: notify admin on new signup request
exports.onApprovalRequest = functions
  .region('asia-south1')
  .database.ref('/approvals/{uid}')
  .onCreate(async (snap, context) => {
    const req = snap.val();
    const adminEmails = functions.config().notifications.admin_emails?.split(',') || [];
    const msg = `New signup request: ${req.role} (uid: ${req.uid})`;
    // e.g. await sendMail(adminEmails, 'Signup Request', msg);
    console.log('Notify admin:', msg);
  });
