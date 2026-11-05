export const PASSWORD_RESET_MESSAGE = "If this address has an email/password account, a reset email will arrive shortly. Check your inbox and spam folder, then follow the link to choose a new password. If you use Google, choose Sign in with Google.";

export function validateAuthForm(mode, { email, password, confirmation }) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  if (mode === "reset") return "";
  if (!password) return "Enter your password.";
  if (mode === "register" && password !== confirmation) return "Passwords do not match. Enter the same password in both fields.";
  if (mode === "register" && password.length < 6) return "Use a password with at least 6 characters.";
  return "";
}

export function passwordPolicyMessage(status) {
  const requirements = [];
  const options = status.passwordPolicy?.customStrengthOptions ?? {};
  if (status.meetsMinPasswordLength === false) requirements.push(`at least ${options.minPasswordLength ?? 6} characters`);
  if (status.meetsMaxPasswordLength === false) requirements.push(`at most ${options.maxPasswordLength} characters`);
  if (status.containsLowercaseLetter === false) requirements.push("a lowercase letter");
  if (status.containsUppercaseLetter === false) requirements.push("an uppercase letter");
  if (status.containsNumericCharacter === false) requirements.push("a number");
  if (status.containsNonAlphanumericCharacter === false) requirements.push("a symbol");
  return requirements.length ? `Your password needs ${requirements.join(", ")}.` : "Choose a stronger password that meets the account requirements.";
}

export function authErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements": return "Choose a stronger password that meets the account requirements.";
    case "auth/email-already-in-use":
    case "auth/account-exists-with-different-credential": return "This address cannot be registered. Sign in using your existing method, such as Google, or use Forgot password for an email/password account.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Unable to sign in with those details. Check your email and password, or use your existing sign-in method.";
    case "auth/user-disabled": return "Unable to sign in. Contact the app owner for help.";
    case "auth/operation-not-allowed": return "This sign-in method is unavailable. Try Google sign-in or contact the app owner.";
    case "auth/network-request-failed": return "Connection unavailable. Check your internet connection and try again.";
    case "auth/too-many-requests": return "Too many attempts. Please wait a while before trying again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "Google sign-in was cancelled. Try again when you are ready.";
    case "auth/popup-blocked": return "Allow the Google sign-in popup in your browser, then try again.";
    default: return "Unable to complete this request. Please try again.";
  }
}

// The Firebase adapter is supplied by auth.js; tests use only mocked calls.
export function createEmailAuthActions(auth, api) {
  return {
    signIn: (email, password) => api.signInWithEmailAndPassword(auth, email.trim(), password),
    async register(email, password) {
      const status = await api.validatePassword(auth, password);
      if (!status.isValid) return { passwordError: passwordPolicyMessage(status) };
      return { result: await api.createUserWithEmailAndPassword(auth, email.trim(), password) };
    },
    async reset(email) {
      try { await api.sendPasswordResetEmail(auth, email.trim()); }
      catch (error) {
        if (!["auth/user-not-found", "auth/invalid-credential"].includes(error?.code)) throw error;
      }
    },
  };
}
