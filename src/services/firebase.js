import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const env = import.meta.env ?? {};
const emulatorHost = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST ?? "";
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? (emulatorHost ? "demo-key" : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? (emulatorHost ? "demo-nevfit.firebaseapp.com" : undefined),
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? (emulatorHost ? "demo-nevfit" : undefined),
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID ?? (emulatorHost ? "demo-app" : undefined),
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
if (emulatorHost) {
  const [host, port] = emulatorHost.split(":");
  connectFirestoreEmulator(db, host, Number(port));
}
export const functions = getFunctions(firebaseApp);

if (env.DEV) {
  console.log("Firebase initialized", {
    projectId: firebaseConfig.projectId,
  });
}
