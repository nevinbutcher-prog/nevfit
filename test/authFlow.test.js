import test from "node:test";
import assert from "node:assert/strict";
import { authErrorMessage, createEmailAuthActions, PASSWORD_RESET_MESSAGE, passwordPolicyMessage, validateAuthForm } from "../src/services/authFlow.js";

test("form validation catches email, confirmation and weak passwords without restricting returning passwords", () => {
  const form = { email: " person@example.com ", password: "secret123", confirmation: "secret123" };
  assert.equal(validateAuthForm("register", form), "");
  assert.match(validateAuthForm("register", { ...form, confirmation: "different" }), /do not match/);
  assert.match(validateAuthForm("register", { ...form, password: "short", confirmation: "short" }), /at least 6/);
  assert.match(validateAuthForm("signin", { ...form, email: "bad" }), /valid email/);
  assert.equal(validateAuthForm("signin", { ...form, password: "old" }), "");
  assert.equal(validateAuthForm("reset", { email: form.email }), "");
});

test("email actions call native adapters, preserve password whitespace and check project policy before creation", async () => {
  const events = [];
  const auth = { name: "mock-auth" };
  let policy = { isValid: false, containsUppercaseLetter: false };
  const api = {
    validatePassword: async (...args) => { events.push(["policy", ...args]); return policy; },
    createUserWithEmailAndPassword: async (...args) => { events.push(["create", ...args]); return { user: { uid: "new-uid" } }; },
    signInWithEmailAndPassword: async (...args) => { events.push(["signin", ...args]); return { user: { uid: "returning-uid" } }; },
  };
  const actions = createEmailAuthActions(auth, api);
  assert.match((await actions.register(" person@example.com ", " secret123 ")).passwordError, /uppercase/);
  assert.equal(events.some(([kind]) => kind === "create"), false);
  policy = { isValid: true };
  assert.equal((await actions.register(" person@example.com ", " secret123 ")).result.user.uid, "new-uid");
  assert.equal((await actions.signIn(" person@example.com ", " secret123 ")).user.uid, "returning-uid");
  assert.deepEqual(events.at(-1), ["signin", auth, "person@example.com", " secret123 "]);
  assert.deepEqual(events.at(-2), ["create", auth, "person@example.com", " secret123 "]);
  assert.match(passwordPolicyMessage({ meetsMinPasswordLength: false, passwordPolicy: { customStrengthOptions: { minPasswordLength: 12 } } }), /12/);
});

test("reset responses remain neutral for absent accounts while connection failures can be retried", async () => {
  let failure = null;
  const actions = createEmailAuthActions({}, { sendPasswordResetEmail: async (_auth, email) => {
    assert.equal(email, "person@example.com");
    if (failure) throw failure;
  } });
  assert.equal(await actions.reset(" person@example.com "), undefined);
  failure = { code: "auth/user-not-found" };
  assert.equal(await actions.reset("person@example.com"), undefined);
  assert.match(PASSWORD_RESET_MESSAGE, /^If this address/);
  failure = { code: "auth/network-request-failed" };
  await assert.rejects(actions.reset("person@example.com"), (error) => error === failure);
});

test("safe error messages hide raw Firebase details and preserve enumeration protection", () => {
  const invalid = authErrorMessage({ code: "auth/invalid-credential" });
  for (const code of ["auth/wrong-password", "auth/user-not-found"]) assert.equal(authErrorMessage({ code }), invalid);
  assert.match(authErrorMessage({ code: "auth/email-already-in-use" }), /existing method.*Google/);
  assert.match(authErrorMessage({ code: "auth/operation-not-allowed" }), /unavailable/);
  assert.match(authErrorMessage({ code: "auth/network-request-failed" }), /connection/i);
  for (const code of ["unknown", "auth/weak-password", "auth/too-many-requests", "auth/popup-blocked"]) {
    assert.doesNotMatch(authErrorMessage({ code, message: "private-credential-detail" }), /private-credential-detail|Firebase|auth\//);
  }
});
