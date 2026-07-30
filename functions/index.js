const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

exports.createEmployee = onCall({ cors: ['http://localhost:5173'] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const profile = (await db.doc(`profiles/${request.auth.uid}`).get()).data();
  if (!profile || profile.role !== 'enterprise_admin' || !profile.company_id) throw new HttpsError('permission-denied', 'Enterprise administrators only.');
  const { email, password, name } = request.data;
  if (!email || !password || !name) throw new HttpsError('invalid-argument', 'Name, email, and password are required.');
  const employee = await admin.auth().createUser({ email: email.toLowerCase(), password, displayName: name });
  const now = new Date().toISOString();
  await db.doc(`profiles/${employee.uid}`).set({ uid: employee.uid, email: email.toLowerCase(), name, role: 'employee', company_id: profile.company_id, created_at: now });
  await db.doc(`companies/${profile.company_id}`).update({ member_uids: admin.firestore.FieldValue.arrayUnion(employee.uid) });
  return { uid: employee.uid, email: employee.email };
});
