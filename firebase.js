// firebase.js - Firebase Auth and Sync logic
import { state, setState } from './state.js';
import { saveToStorage } from './storage.js';

const FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;

let fbApp  = null;
let fbAuth = null;
let fbDb   = null;

export async function initFirebase() {
  if (!FIREBASE_CONFIG) return false;
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth(fbApp);
    fbDb   = firebase.database(fbApp);
    return true;
  } catch (e) {
    try {
      fbApp  = firebase.app();
      fbAuth = firebase.auth();
      fbDb   = firebase.database();
      return true;
    } catch (e2) {
      return false;
    }
  }
}

export async function pushToCloud() {
  const user = state.fbUser;
  if (!fbDb || !user) return;
  try {
    await fbDb.ref('users/' + user.uid + '/tracker').set({
      db: state.db,
      habits: state.habits,
      pinnedTasks: state.pinnedTasks,
      nextId: state.nextId,
      reminders: state.reminders,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // Note: showToast will be imported/called via ui.js or a bridge in app.js
    // For now we'll use a custom event or callback to trigger the toast
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Cloud sync failed. Check connection.' }));
    console.warn('Firebase push failed:', e);
  }
}

export async function pullFromCloud() {
  const user = state.fbUser;
  if (!fbDb || !user) return false;
  try {
    const snap = await fbDb.ref('users/' + user.uid + '/tracker').get();
    if (!snap.exists()) return false;
    const d = snap.val();

    setState('db', d.db ?? state.db);
    setState('habits', d.habits ?? state.habits);
    setState('pinnedTasks', d.pinnedTasks ?? state.pinnedTasks);
    setState('nextId', d.nextId ?? state.nextId);
    setState('reminders', d.reminders ?? state.reminders);

    return true;
  } catch (e) {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: 'Failed to retrieve cloud data.' }));
    console.warn('Firebase pull failed:', e);
    return false;
  }
}

export async function signIn(email, pass) {
  if (!fbAuth) throw new Error('Sync not configured.');
  return await fbAuth.signInWithEmailAndPassword(email, pass);
}

export async function register(email, pass, conf) {
  if (!fbAuth) throw new Error('Sync not configured.');
  if (pass.length < 6) throw new Error('Password must be at least 6 characters.');
  if (pass !== conf) throw new Error('Passwords do not match.');
  return await fbAuth.createUserWithEmailAndPassword(email, pass);
}

export async function sendPasswordReset(email) {
  if (!fbAuth) throw new Error('Sync not configured.');
  return await fbAuth.sendPasswordResetEmail(email);
}

export async function changePassword(current, newPass, conf) {
  if (!fbAuth || !state.fbUser) throw new Error('Auth session not active.');
  if (newPass.length < 6) throw new Error('New password must be at least 6 characters.');
  if (newPass !== conf) throw new Error('New passwords do not match.');

  const credential = firebase.auth.EmailAuthProvider.credential(state.fbUser.email, current);
  await state.fbUser.reauthenticateWithCredential(credential);
  return await state.fbUser.updatePassword(newPass);
}

export async function signOut() {
  if (!fbAuth) return;
  return await fbAuth.signOut();
}

export async function deleteAccount(pass) {
  if (!fbAuth || !state.fbUser) throw new Error('Auth session not active.');
  const credential = firebase.auth.EmailAuthProvider.credential(state.fbUser.email, pass);
  await state.fbUser.reauthenticateWithCredential(credential);
  if (fbDb) await fbDb.ref('users/' + state.fbUser.uid).remove();
  return await state.fbUser.delete();
}

export function getAuth() { return fbAuth; }
export function getDb() { return fbDb; }
