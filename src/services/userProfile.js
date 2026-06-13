import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

function getProviderId(user) {
  return user.providerId ?? user.providerData?.[0]?.providerId ?? null;
}

export async function ensureUserProfile(user) {
  if (!user) {
    return;
  }

  const profileRef = doc(db, "users", user.uid);
  const profileSnapshot = await getDoc(profileRef);
  const profile = {
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null,
    providerId: getProviderId(user),
    updatedAt: serverTimestamp(),
    ...(profileSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
  };

  await setDoc(profileRef, profile, { merge: true });

  if (import.meta.env.DEV) {
    console.log("User profile synced", { uid: user.uid });
  }
}
