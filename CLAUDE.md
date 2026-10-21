# HARTFELT-UX-DONE-1 — permanent development standard

Applies to every user-facing feature in this app. This is a project instruction, not a session note.

## Before building

1. Identify the user's entry point.
2. Identify every required action and button.
3. Map the complete user journey.
4. Confirm navigation and permissions.

## Before declaring done

1. Verify the entry point exists.
2. Verify buttons and forms are visible.
3. Test the complete user journey.
4. Verify results appear correctly.
5. Test authorized **and** denied roles.
6. Test desktop and mobile where applicable.
7. Run CI and the existing security gates.

## What counts as evidence

Automated UI/component tests and browser E2E tests, when available.

**A source-code assertion is not proof that a button renders or works.** Grepping a handler, a
route case, or a screen name proves the string exists. It does not prove the screen mounts, the
button is reachable, the press fires, or the result appears. Pure-function tests over the same
logic prove the logic, not the interface.

If authenticated browser testing is unavailable, report **UI E2E: UNVERIFIED** and say which step
was not exercised. Never substitute a database test, an API test, or a source assertion and claim
the interface passed.

## Release rule

Backend PASS + CI PASS != USER WORKFLOW PASS.

Never report a user-facing feature as fully complete while its entry point or primary action is
unverified. Name the unverified part in the report, every time.

## Report format

```
Feature:
Entry point:
Primary action:
Workflow result:
UI E2E: PASS/FAIL/UNVERIFIED
CI:
Production:
Blockers:
```

## Gates are preserved

This standard adds a requirement and removes none. Every existing security, release,
broker-approval and production gate stands exactly as it did.

## In this repo — UI evidence IS available, so UNVERIFIED needs a reason

Measured 2026-10-21; re-measure before relying on it.

This repo runs **jest** with `@testing-library/react` and `@testing-library/jest-dom`, and already
carries 64 `.tsx` test suites that mount real components. A UI claim here can be backed by a
rendering test, so **"UI E2E: UNVERIFIED" on a component jest can mount is not acceptable** —
write the test.

For any user-facing change here, the rendering test should assert what the user sees and does:

- the entry point is present (the nav item, the card, the link that reaches the feature),
- the primary action is visible and enabled for an authorized role,
- the action's result appears,
- and a denied role does not see or cannot fire it.

The runner is **jest, not vitest**. A vitest-style suite does not fail here — it fails to *parse*,
which reads like a broken component rather than a wrong import. `npm test` is `jest`.

Browser E2E (Playwright/Cypress) is not set up. Where a workflow genuinely needs a real browser —
redirects, middleware, session cookies — report **UI E2E: UNVERIFIED** for that step specifically
and say why a component test cannot cover it.

The required `verify` check and strict branch protection are unchanged by this standard.
