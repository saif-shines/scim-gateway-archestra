This project is a prototype that connects Archestra AI to any SCIM directory such as Okta, Microsoft Entra ID, JumpCloud, Google workspace ans o on.

It's still work in progress.

## Environment Variables

The sync service expects these environment variables:

- `SCALEKIT_ENVIRONMENT_URL`
- `SCALEKIT_CLIENT_ID`
- `SCALEKIT_CLIENT_SECRET`
- `SCALEKIT_WEBHOOK_SECRET`
- `ARCHESTRA_APIKEY`
- `ARCHESTRA_API_BASE_URL` (optional, defaults to `http://localhost:9000`)
- `ARCHESTRA_APP_BASE_URL` (optional, defaults to `http://localhost:3000`)
- `ARCHESTRA_SESSION_TOKEN` (optional, used for hackathon invite flow)
- `ARCHESTRA_INVITE_COOKIE_HEADER` (optional override for full Cookie header)
- `ARCHESTRA_INVITE_DEFAULT_ROLE` (optional, defaults to `editor`)
- `ORGANIZATION_ID` (used by `/scim-gateway` page rendering)

## Webhook Sync Behavior

- Validates Scalekit webhook signatures with `SCALEKIT_WEBHOOK_SECRET`
- Returns `401` for invalid signatures
- Auto-creates organization mapping when unknown `organization_id` is received
- Team mapping rule:
  - Primary: `department`
  - Fallback: `dp_roles[0].value`
- Processes duplicate notifications independently (no dedup store)
- Retries downstream Archestra failure exactly once, then marks sync failed

## Local Validation

Run all tests:

```bash
deno task test
```

Run focused suites:

```bash
deno task test:unit
deno task test:contract
deno task test:integration
```