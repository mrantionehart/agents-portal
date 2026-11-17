# Forward legacy Agent Portal AI generation through Vault

Replace AP's direct Anthropic chat and CloseIQ endpoints with thin `proxyToVault` forwarders. Keep AP URLs, bodies and returned JSON/statuses intact for `/ai-chat`, `/closeiq` and EASE CloseIQScreen. The existing helper forwards Bearer credentials or the portal cookie session's access token. Vault owns token validation, tenant attribution, model selection and usage accounting.

Template upload still extracts PDF fields, uploads the template and saves metadata in AP; only its AI mapping request forwards to Vault. GET/PATCH CRUD and exact broker upload gate remain unchanged. Mapping remains optional: Vault 503 results in an empty suggestion and successful upload, matching the former provider-failure behavior. No UI files changed, no auth provider imports changed, and no new route requires an allowlist entry. All `ANTHROPIC_API_KEY` and direct `api.anthropic.com` use was removed from AP code.

## Required rollout order

1. **Vault PR merged and deployed FIRST**, including separately authorized application of staged `20271406000000_ai_legacy_usage.sql` after production ledger max `20271405000000`. Operator must recheck collision against the live ledger before applying. No production operations were performed in this task.
2. **Owner sets the Vault model environment variables next:** `AI_LEGACY_CHAT_MODEL`, `AI_LEGACY_COVER_LETTER_MODEL`, `AI_LEGACY_RISK_ANALYSIS_MODEL`, `AI_LEGACY_PARSE_VOICE_MODEL`, `AI_LEGACY_TEMPLATE_MAPPING_MODEL`. AP previously used `claude-sonnet-4-20250514` hardcoded for CloseIQ/mapping and as chat's `ANTHROPIC_MODEL` default; owner chooses an equivalent model. Unset models return 503; chat's old no-key rule-based mode is replaced by that requested fail-closed behavior.
3. **Then merge/deploy this AP PR.** Vault `AI_LEGACY_ROUTES_ENABLED` defaults ON for these existing features; explicitly set `false` for emergency disable. P1–P6 flags remain OFF and are independent. No env, deployment or cron files changed.

Revert AP code before removing Vault endpoints. Disabling the Vault kill switch returns 503 for chat/CloseIQ while template upload continues with no suggestion. No generated email/SMS text is sent.

## Validation

18/18 collected Jest tests passed (12 new forwarder/upload cases and 6 existing helper cases), using `--watchman=false` because the sandbox denies Watchman state-directory changes. Covers success, unchanged Vault 503, missing authentication, cookie-to-Bearer forwarding, mapping persistence/fallback and denied upload roles. API route security marker guard passed (110 routes). UI E2E: UNVERIFIED for real-browser/mobile authenticated request and rendering; no UI changes, production calls or external delivery. Full required `verify` CI remains for the eventual PR.
