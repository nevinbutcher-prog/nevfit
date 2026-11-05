# NevFit — Authentication Screen Visual Polish

**Checkpoint:** Focused visual-polish follow-up to email/password authentication.  
**Suggested implementation commit:** `style: polish nevfit authentication screen`

## User intent

The new email/password sign-in and registration are functional but the mobile screen feels overly plain and utilitarian. Improve its personality, visual hierarchy and proportions while retaining a clean, professional NevFit identity and the same fast, frictionless account-creation journey.

The user approved the restrained visual direction discussed: a strong NevFit brand header, subtle emerald fitness accent, warmer outcome-focused tagline, compact single-card form, clear segmented Sign in/Create account selection and visually secondary Google option. **Do not build a new gym-oriented brand, stock-photo splash screen or additional onboarding.**

## Required experience

- Improve only `src/components/SignInScreen.jsx` and any minimal presentation-only support. Keep existing dark/emerald design language and mobile-first layout.
- Make the NevFit title the visual anchor; introduce a small, tasteful emerald accent (simple CSS or an already-installed icon, not an external image asset/dependency). Suggested messaging: **“Train with purpose.”** and **“Build your routine. Track your progress. Get stronger.”** Refine the phrasing modestly if needed.
- Keep accessible **Sign in** / **Create account** tabs, but remove the visually redundant second `Sign in` / `Create account` heading beneath the tabs. Make the selected mode unmistakable.
- Tighten vertical spacing and control proportions sensibly, particularly on a narrow iPhone viewport with the keyboard open. Keep inputs and buttons touch-friendly (44px minimum) and text readable.
- Give the primary submit button clear emphasis; keep **Forgot password?** easy to find without dominating the form. In reset mode, communicate the purpose and preserve an obvious way back.
- Separate the existing Google sign-in with a subtle **“or continue with”** divider and secondary button styling.
- Preserve functional validation messages, loading/disabled states, labels, focus affordances and keyboard accessibility. Maintain sensible layout for longer messages and for reset-password flow.

## Strict boundaries

**Presentation-only.** Do not modify `src/services/auth.js`, `authFlow.js`, Firebase settings, account isolation, registration/login/reset logic, routing, Firestore, user storage or provider behaviour. No new auth features, no account linking, no additional onboarding or dependencies. No Computer Use requirement.

## Validation / handoff

Check the three visual modes in code (sign-in, registration, reset) and review loading/error states; user will visually verify on phone. Run lint/build and only existing directly relevant tests if useful; do not create an extensive visual test suite or use browser automation, paid AI, real registration or real password reset during automated checks.

Follow `AGENTS.md` and `docs/nevdev_workflow.md`: implement one checkpoint, update docs only if genuinely needed, archive brief sequentially, clear `briefs/nextbrief.md`, commit and push, verify Vercel deployment, and stop for independent review and user acceptance.
