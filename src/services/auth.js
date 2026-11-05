import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  validatePassword,
} from "firebase/auth";
import { auth } from "./firebase";
import { createEmailAuthActions } from "./authFlow.js";

const emailActions = createEmailAuthActions(auth, { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, validatePassword });
export const signInWithEmail = emailActions.signIn;
export const registerWithEmail = emailActions.register;
export const requestPasswordReset = emailActions.reset;

const googleProvider = new GoogleAuthProvider();

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    providerId: user.providerData?.[0]?.providerId ?? user.providerId ?? null,
  };
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);

  return normalizeUser(result.user);
}

export async function signOutUser() {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback) {
  return onAuthStateChanged(
    auth,
    (user) => callback(normalizeUser(user)),
    () => {
      callback(null);
    },
  );
}
