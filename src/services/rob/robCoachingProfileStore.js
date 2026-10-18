import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { normalizeRobCoachingProfile, robCoachingProfileDocumentSegments } from "./robCoachingProfile.js";

const profileDocument = (uid) => doc(db, ...robCoachingProfileDocumentSegments(uid));

export async function loadRobCoachingProfile(uid) {
  const snapshot = await getDoc(profileDocument(uid));
  return normalizeRobCoachingProfile(snapshot.exists() ? snapshot.data() : null);
}

export async function saveRobCoachingProfile(uid, profile) {
  const normalized = normalizeRobCoachingProfile(profile);
  await setDoc(profileDocument(uid), { ...normalized, updatedAt: serverTimestamp() });
  return normalized;
}
