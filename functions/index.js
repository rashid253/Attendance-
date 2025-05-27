// functions/index.js
// -------------------------------------------
// Updated Cloud Functions for admin approvals using HTTPS Callable (v1)

// Force Firebase Functions to treat code as v1
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'attandace-management';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

// Initialize the Admin SDK
admin.initializeApp();

/**
 * Callable function to set a custom claim on a user.
 * Only admins (with role claim 'admin') can invoke this.
 */
exports.setCustomClaim = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // Verify caller is authenticated and has admin role
    if (!(context.auth && context.auth.token.role === 'admin')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only administrators can modify roles.'
      );
    }

    const { uid, claimKey = 'role', claimValue } = data;
    if (!uid || !claimValue) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Function must be called with uid and claimValue.'
      );
    }

    try {
      await admin.auth().setCustomUserClaims(uid, { [claimKey]: claimValue });
      return { success: true };
    } catch (error) {
      console.error('setCustomClaim error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });

/**
 * Callable function to delete a user by UID.
 * Only admins (with role claim 'admin') can invoke this.
 */
exports.deleteUser = functions
  .region('asia-south1')
  .https.onCall(async (data, context) => {
    // Verify caller is authenticated and has admin role
    if (!(context.auth && context.auth.token.role === 'admin')) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only administrators can delete users.'
      );
    }

    const { uid } = data;
    if (!uid) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Function must be called with a uid.'
      );
    }

    try {
      await admin.auth().deleteUser(uid);
      return { success: true };
    } catch (error) {
      console.error('deleteUser error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
