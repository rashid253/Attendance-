// File: functions/index.js
const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

// 1) Callable: set custom role claims
exports.setCustomClaim = functions.https.onCall(async (data, ctx) => {
  if (ctx.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied','Only admins can set claims');
  }
  const { uid, role } = data;
  await admin.auth().setCustomUserClaims(uid, { role });
  return { success: true };
});

// 2) Firestore/RTDB trigger: notify admin on new signup request
exports.onApprovalRequest = functions.database
  .ref('/approvals/{uid}')
  .onCreate(async (snap, context) => {
    const req = snap.val();
    // TODO: integrate SendGrid or Twilio via functions.config()
    const adminEmails = functions.config().notifications.admin_emails.split(',');
    const msg = `New signup request: ${req.role} (uid: ${req.uid})`;
    // e.g. await sendMail(adminEmails, 'Signup Request', msg);
    console.log('Notify admin:', msg);
  });
