const admin = require('firebase-admin');

const serviceAccount = require('./attandace-management-firebase-adminsdk-fbsvc-cb3d1d04e4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setRoleForUser(uid, role) {
  try {
    await admin.auth().setCustomUserClaims(uid, { role: role });
    console.log(`Success: User ${uid} کو رول '${role}' دے دیا گیا۔`);
    process.exit(0);
  } catch (error) {
    console.error('Error setting custom claim:', error);
    process.exit(1);
  }
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('استعمال: node setRole.js <USER_UID> <ROLE>');
  console.log('مثال: node setRole.js z0d1AbC2DeF3GhIJkLmN9 teacher');
  process.exit(1);
}
const uid = args[0];
const role = args[1];

setRoleForUser(uid, role);
