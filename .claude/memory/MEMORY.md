# SynaPilot OS — Claude Memory

## Project
PropTech SaaS for French real estate agencies. Stack: React 18 + Vite + TypeScript + Shadcn/UI + Supabase.
Supabase project ID: `svtwaxnaghrjyogcljnp` (eu-west-1).

## Key IDs (seeded)
- Admin user_id: `6ba5fb66-fd29-4add-af94-f713e837d8dd`
- Organization ID: `a0000000-0000-0000-0000-000000000001`

## AI Provider
All Edge Functions use **DeepSeek** (`DEEPSEEK_API_KEY`), NOT OpenAI. Functions: `generate-email-template`, `generate-ai-message`.

## Edge Functions (all ACTIVE as of 2026-02-23)
| Function | verify_jwt | Notes |
|---|---|---|
| analyze-dpe | true | existing |
| fetch-market-data | false | existing |
| send-property-proposal | true | existing |
| stripe-webhook | false | Stripe sig verified, handles 4 events |
| create-checkout-session | true | admin-only |
| invite-agent | true | admin-only |
| generate-email-template | false | own JWT check in code |
| generate-ai-message | false | own JWT check in code |
| create-portal-session | true | admin-only, requires stripe_customer_id |
| process-email-sequences | false | scheduled hourly `0 * * * *` |

## Sequence Step Schema
`email_sequences.steps` is JSONB array of `{ delay_days: number, subject: string, body: string }`.
`next_send_at = enrolled_at + step.delay_days` (delay is from enrollment, not from previous step).

## Known Bugs (not fixed — out of scope)
- `useOrganization()` and `useProfile()` hooks in `src/hooks/useOrganization.ts` use `.eq('id', user.id)` but should use `.eq('user_id', user.id)`. AuthContext fetches correctly; these hooks may return null data in Settings/Profile display.

## RLS Summary
- All org tables use `get_auth_user_org_id()` function for scoping
- `organizations` uses `get_user_org_id()` (slightly different function)
- `subscriptions`: SELECT-only for users; writes via service_role only
- `user_roles`: has UPDATE policy for org members (added 2026-02-23)
- `organizations`: has UPDATE policy for org members (added 2026-02-23)

## config.toml
Correct project_id: `svtwaxnaghrjyogcljnp`. Scheduled function `process-email-sequences` registered with `schedule = "0 * * * *"`.
