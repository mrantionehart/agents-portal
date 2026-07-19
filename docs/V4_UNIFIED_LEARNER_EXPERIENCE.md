# V4 Unified Learner Experience — AP technical reference

Agent Portal delivery that renders the HartFelt Platform Certified curriculum
(32 lessons across 6 tracks) as a first-class learner surface. Complements the
Vault-side `hartfelt-vault#36` catalog projection extension.

## Scope

The AP owns rendering, navigation, learner interaction, API orchestration,
and progress presentation. Vault is authoritative for lesson definitions,
prerequisites, tour scripts, practical evaluators, checklist steps, quiz
questions, scoring, completion, and issuance. No curriculum data lives on
the AP side.

## Route model

- `/training/certified/[trackId]` — track lesson list (`CertifiedTrackClient`).
- `/training/certified/[trackId]/[lessonId]` — unified lesson page
  (`UnifiedLessonClient`), dispatches activity components per
  `lesson.requirements[]`.
- `/training/checklist?session=<id>` — checklist reflection session
  (`ChecklistPageClient`).
- `/training/checklist?lesson=<id>&activity=...&evaluator_key=...&criterion_version=...`
  — starts a new session then rewrites the URL to `?session=<id>`.
- `/training/quiz?lesson=<id>` — learner-safe quiz + attempt (`QuizPageClient`).
- `/training/wizard?…` — the pre-existing pcert-l04 transaction wizard (unchanged).

Middleware `TRAINING_GATE_ALLOWED` already permits `/training/…`, so no
middleware change was required.

## Vault API contract consumed

Every call is client-side, `Authorization: Bearer <supabase-access-token>`.

| Endpoint | Purpose |
|---|---|
| `GET  /api/platform/certifications/{cert}/catalog` | Track + lesson list with `requirements`, `session_ui_spec`, `practical_ui_spec` |
| `GET  /api/platform/certifications/{cert}/progress` | Caller-scoped per-lesson status + issuance envelope. `?userId=` is rejected 400 |
| `GET  /api/platform/certifications/{cert}/lessons/{id}/tour` | Tour script (learner mode, no `?preview=true`) |
| `POST /api/platform/certifications/{cert}/lessons/{id}/complete` | Tour completion (via `TourProvider`) or empty body for Family A signal evaluation |
| `GET  /api/platform/certifications/{cert}/lessons/{id}/quiz` | Learner-safe projection (no `correctOptionId`, no `explanationOnSubmit`) |
| `POST /api/platform/certifications/{cert}/lessons/{id}/quiz/attempt` | Submits attempt; server grades, persists, and issues on pcert-l32 pass |
| `POST /api/activity-sessions/start` | Opens a scenario/wizard session |
| `GET  /api/activity-sessions/[id]` | Owner-only session projection |
| `PATCH /api/activity-sessions/[id]` | Session state + completed_steps |
| `POST /api/activity-sessions/[id]/complete` | Server evaluates criterion; cascades to lesson complete |

The AP HTTP client lives in [`api.ts`](../src/portal/training/certified/api.ts).
Errors surface as `CertApiError { status, code, message }`; the code is the raw
server envelope code (`prerequisite_not_complete`, `attempt_cap_reached`, …).

## Activity renderer

`UnifiedLessonClient` reads `lesson.requirements: ("tour"|"practical"|"quiz")[]`
and renders one block per entry:

- `"tour"` → [`LearnerTourLauncher`](../src/portal/training/certified/activities/LearnerTourLauncher.tsx).
  Invokes `useTour().start({ certificationId, lessonId, preview: false, userId })`.
  The tour engine (mounted in `(portal)/layout.tsx`) handles overlay + persistence.
  Completion (`state.completed` transition) triggers `onCompletion` → progress refetch.
- `"practical"` → dispatched by criterion family:
  - `lesson.practical_ui_spec !== null` → [`FamilyAGuidanceCard`](../src/portal/training/certified/activities/FamilyAGuidanceCard.tsx)
    (pcert-l03: displays only allowlisted signal identifiers, links to
    Notifications + Settings, POSTs empty complete for server-side signal
    verification).
  - `session_ui_spec.activity_type === "transaction_wizard"` →
    [`WizardLaunchLink`](../src/portal/training/certified/activities/WizardLaunchLink.tsx)
    (pcert-l04: deep-links to `/training/wizard` with canonical query).
  - `session_ui_spec.activity_type === "scenario"` →
    [`ChecklistLauncher`](../src/portal/training/certified/activities/ChecklistLauncher.tsx)
    (14 checklist lessons: deep-links to `/training/checklist`).
  - No matching family → fail-closed "unsupported" notice.
- `"quiz"` → [`QuizLauncher`](../src/portal/training/certified/activities/QuizLauncher.tsx)
  (8 quiz lessons; pcert-l32 rendered as Final Certification Exam).

Unrecognized requirement kinds render a fail-closed rose-colored notice.

## Tour integration

- `TourProvider` + `TourRunner` are mounted **once** in
  `app/(portal)/layout.tsx`. Every `(portal)/*` route inherits it, including
  `/training/certified/*`.
- The learner launcher invokes `tour.start({ preview: false })`. `preview: true`
  is reserved for `BrokerPreviewLauncher` (broker-role-gated, no completion write).
- The tour engine's `finish()` writes the completion attestation via
  `submitTourCompletion` when `previewIntentRef === false`; it never writes
  when previewing. This is Vault's authority, not the AP's.

## Checklist session lifecycle

1. Learner clicks **Open the checklist** on the lesson page →
   `/training/checklist?lesson=<id>&activity=scenario&evaluator_key=...&criterion_version=...`
2. `ChecklistPageClient` calls `POST /api/activity-sessions/start` and then
   `router.replace('/training/checklist?session=<id>')`.
3. Steps are ticked → `PATCH { completed_steps }`. Reflections are typed +
   persisted on blur → `PATCH { state: { reflections } }`.
4. Submit → `POST /api/activity-sessions/<id>/complete`. Server validates via
   `checklist-reflection.completed.v1`, cascades to `lessons/<id>/complete`,
   writes the attestation.
5. On success, the client renders "Checklist submitted" and links back to the
   lesson page.

Every `SessionApiError.apiCode` (the raw server code) maps to a specific
learner-facing message in `classifyError` — no silent generic errors.

Reflection minimum-length is enforced client-side for UX (disables Submit),
but the server is the final authority (`session_invalid_state` returned on
sub-minimum text is surfaced with a friendly message).

## Quiz lifecycle

1. Learner clicks **Take the quiz** → `/training/quiz?lesson=<id>`.
2. `QuizPageClient` fetches the learner-safe projection. The response
   NEVER contains `correctOptionId` / `explanationOnSubmit`. Radio options
   are rendered in the server-returned order.
3. Learner picks options and clicks **Submit**. The submission POST body
   contains only `{ quizId, quizVersion, answers: [{ questionId, optionId }] }`
   — no `user_id`, `tenant_id`, `score`, `passed`, `attempt_id`, or
   `issuance_id`.
4. Server response includes `{ result: { score, passed, ... }, status,
   certification_issuance | null }`.
5. On a passing pcert-l32 attempt, `certification_issuance` is populated
   with `{ issuance_id, certification_id, certification_version, issued_at }`
   and the client renders a distinct "🏁 Certification issued" block. All
   other passes show only the score card.
6. `attempt_cap_reached` (429) renders a friendly ceiling notice; retry is
   offered when the server returns `retry_allowed_at`.

## Prerequisite behavior

`isPrerequisiteUnlocked(progress, lesson)` returns true only when the
lesson's `prerequisite_lesson_id` is null OR the referenced lesson's status
in the progress projection is `"completed"`. Locked lessons render as a
`PrereqLocked` card with the prereq lesson's title.

The server also enforces prereq via `prerequisite_not_complete` on every
mutation endpoint — the AP never needs to trust its local view.

## Broker Preview separation

`BrokerCertPreviewSection` remains, but:

- The stale "Volume 4 is in draft" and "Agents do not see any Volume 4
  content" copy is removed.
- Copy now points brokers at the fact that learners have their own
  destination under `/training/certified`.
- The section still renders `null` for non-broker roles.
- The launcher still calls `tour.start({ preview: true })` — no completion
  writes — for the 8 pilot lessons.

## Testing strategy

- **Pure helpers** — [`training-helpers-v4.test.ts`](../src/portal/training/__tests__/training-helpers-v4.test.ts)
  and [`progress-helpers.test.ts`](../src/portal/training/certified/__tests__/progress-helpers.test.ts)
  lock volume-aware `open_url` routing (Vol 4 → `/training/certified/<id>`, unknown
  → inert `#`) and every branch of prereq / progress derivation.
- **HTTP client** — [`api.test.ts`](../src/portal/training/certified/__tests__/api.test.ts)
  locks Bearer-authed URLs, error envelope surfacing, the learner-safe quiz
  projection, and the guarantee that submission bodies never smuggle
  `user_id`/`tenant_id`/`score`/`passed`/`attempt_id`/`issuance_id`.
- **Activity components** — [`LearnerTourLauncher.test.tsx`](../src/portal/training/certified/activities/__tests__/LearnerTourLauncher.test.tsx)
  locks the `preview: false` invariant; [`FamilyAGuidanceCard.test.tsx`](../src/portal/training/certified/activities/__tests__/FamilyAGuidanceCard.test.tsx)
  proves phone numbers and notification bodies never appear; [`link-launchers.test.tsx`](../src/portal/training/certified/activities/__tests__/link-launchers.test.tsx)
  locks the exact query strings + fail-closed activity_type checks + final-exam
  branding.
- **Broker Preview copy lock** — [`broker-preview-v4-copy.test.tsx`](../src/portal/tour/__tests__/broker-preview-v4-copy.test.tsx)
  asserts the stale copy is gone and the non-writing invariant is preserved.

Full AP suite: **1,496 passing.** No regressions from this branch.

## Jest configuration

`jest.config.js` `moduleNameMapper` was updated from `@/(.*)$ → src/$1` to
`@/(.*)$ → $1` to match `tsconfig.json`. The AP has `app/`, `lib/`, and
`src/` side-by-side at the repo root, and the tsconfig `@/*` alias points
at the root. No existing test relied on the old mapping — all existing
`@/` imports live inside production files and resolve via tsconfig anyway.
