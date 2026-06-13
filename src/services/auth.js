import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

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
    (error) => {
      console.error("Firebase auth listener failed:", error);
      callback(null);
    },
  );
}
