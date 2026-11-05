# NevFit — Email/Password Registration and Sign-In V1

**Checkpoint:** Final agreed rotation item. New users can create their own account without using Google. Firebase Email/Password provider has already been enabled by the product owner.  
**Suggested implementation commit:** `feat: add email password authentication`

## User intent

Make it easy for another person (starting with the user's wife) to register and use NevFit independently, with their **own** programs, routines, activities and Rob settings. This is **not** an alternative sign-in method for the existing Google account and does **not** require account linking.

## Expected experience

- On the existing unauthenticated NevFit login screen, offer **Sign in**, **Create account** and **Forgot password** for email/password, alongside the existing **Sign in with Google** option. Present a clean, mobile-first, straightforward UI rather than an intimidating form.
- **Create account:** email, password and confirmation; validate obvious errors, matching passwords and Firebase password requirements. Use Firebase Authentication's native `createUserWithEmailAndPassword`. On success enter the existing authenticated onboarding/initialization flow for this **new UID**.
- **Sign in:** email/password via Firebase Auth `signInWithEmailAndPassword`; maintain established auth loading and app hydration semantics.
- **Forgot password:** email field and Firebase `sendPasswordResetEmail`; explain next steps with neutral wording that doesn't expose whether an account exists. No custom email service.
- Preserve existing **Google sign-in** fully. If a user registers with an address already used by a Google account, show a safe explanation to sign in with the existing method; **do not auto-link, merge, overwrite or migrate user data**.
- Show friendly, actionable errors (invalid email, mismatched/weak password, account already in use, incorrect credentials, disabled operation, network error) without exposing raw Firebase error strings or internal details. Respect Firebase's email-enumeration protections. Disable in-flight submit buttons, prevent accidental duplicate requests, support Enter/keyboard and accessible input labels, and retain sensible focus/form states.
- Never store passwords in Firestore, localStorage, user profile or logs. Avoid logging raw credentials or sensitive auth errors.
- Account separation is critical: preserve the existing `users/{uid}` Firestore boundaries; a newly registered account must not pick up the last Google user's programs, schedule, health, completed history or Rob preferences from shared browser caches or first-load migration. Inspect auth listener, `src/App.jsx` hydration, cache owner checks and program migration paths; fix a demonstrable cross-account bootstrap leak **within this scope** if found, without unnecessary refactoring.
- Keep sign-out and returning-user sign-in working normally.

## Constraints

Reuse the existing `src/services/auth.js`, `SignInScreen` in `src/App.jsx` (extract small component only if it meaningfully improves maintainability), Firebase client setup and established design language. Firebase Email/Password provider is already configured; do not require a new backend, Firestore rules, secret, Cloud Function or billing setting.

Do **not** build usernames, account linking, Google account conversion, shared households, invitations, social auth, profiles onboarding, custom verification-email flows, custom password policies or any additional training feature. Do not mutate the existing Google user's UID or data. A basic Firebase email verification mechanism is not needed for V1 unless existing security architecture explicitly requires it.

## Targeted validation and handoff

- New email/password registration creates an independent UID and enters the app successfully; account survives sign-out, reload and sign-in.
- A different user signing into the same browser gets their own independent data (including empty/new defaults where appropriate), with no prior user's activities or programs leaking through the local cache.
- Existing Google sign-in remains usable and reads original data.
- Incorrect password, duplicate email, mismatched password, weak password, offline operation and reset-email request produce usable feedback without crashes; credentials aren't stored/logged.
- Check sign-out and in-flight auth UI states.
- Run a **small number of focused tests** for auth helper/error mapping/UI logic and existing relevant auth/hydration checks where available, plus lint/build. Mock Firebase calls; do not perform automated real-account creation or send real password-reset emails. **No Computer Use, browser automation acceptance requirement, broad test suites or paid AI calls.** User will manually verify with an intended new account.

Follow `AGENTS.md` and `docs/nevdev_workflow.md`: update only relevant docs, archive brief sequentially, clear `briefs/nextbrief.md`, commit/push and verify Vercel. Report any separate Firebase setting blockers without altering broader configuration. Stop after this checkpoint; independent review and user acceptance remain separate.
