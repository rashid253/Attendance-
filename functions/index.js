// functions/index.js
// -------------------------------------------
// Cloud Functions (asia-south1) for admin approvals
// Uses HTTPS Callables—no CORS middleware needed.

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'attandace-management';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();

/**
 * Callable function: setCustomClaim
 * - Only callable by authenticated users with admin role
 * - Expects data: { uid: string, claimValue: any }
 */
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // Auth & role check
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can assign roles.');
    }

    const { uid, claimValue } = data;
    if (!uid || claimValue === undefined) {
      throw new functions.https.HttpsError('invalid-argument', 'Must supply uid and claimValue.');
    }

    try {
      // Here we set the 'role' claim to claimValue
      await admin.auth().setCustomUserClaims(uid, { role: claimValue });
      return { success: true };
    } catch (error) {
      console.error('setCustomClaim error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Callable function: deleteUser
 * - Only callable by authenticated users with admin role
 * - Expects data: { uid: string }
 */
exports.deleteUser = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // Auth & role check
    if (!context.auth || context.auth.token.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can delete users.');
    }

    const { uid } = data;
    if (!uid) {
      throw new functions.https.HttpsError('invalid-argument', 'Must supply uid.');
    }

    try {
      await admin.auth().deleteUser(uid);
      return { success: true };
    } catch (error) {
      console.error('deleteUser error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
