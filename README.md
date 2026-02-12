# Archestra SCIM Gateway

## Problem

Archestra is a platform for AI workflows and integrations. This project adds a **SCIM gateway** and an **admin portal** so you can connect Archestra to your organization’s existing directory—Okta, Microsoft Entra ID, JumpCloud, Google Workspace, and similar. Instead of managing users and access in isolation, you configure the gateway once with your directory, and it helps keep provisioning and access in sync. The goal is to complement Archestra with clearer governance and control: who can use what, and how they get onboarded, stays aligned with your identity provider.

## How it works

You use a **web admin portal** (served at `/scim-gateway` on the same port as other gateways) to configure the SCIM gateway with your organization’s directory. That directory is connected through **Scalekit**, which talks to providers like Okta, Entra ID, and JumpCloud. When users or teams change in your directory, the gateway can provision and deprovision access in Archestra. Some of that wiring uses custom-built APIs where the platform’s existing APIs were built for different use cases (for example, application-level roles rather than per-user roles), so a session token is supplied via environment variable to drive access provisioning and deprovisioning through the SCIM gateway.

### Architecture (high level)

```
  +------------------+     +-------------+     +----------------+     +------------------------+
  |  Admin portal    |     |  Scalekit   |     |  SCIM Gateway  |     |  Enterprise directory  |
  |  (/scim-gateway) |---->|  (identity  |---->|  (this project)|---->|  (Okta, Entra,         |
  |                  |     |   / IdP)    |     |                |     |   JumpCloud, etc.)     |
  +------------------+     +-------------+     +----------------+     +------------------------+
         ^                         ^                     ^                         ^
         |                         |                     |                         |
         |  configure org/dir      |  webhook & auth      |  provision /            |  source of
         |  & mappings             |                     |  deprovision users      |  truth for users
         |                         |                     |                         |
  +------+                         |                     +------------------------+
  | You | (browser)                 |                     |  Archestra (apps,      |
  +------+                          |                     |   sessions, roles)     |
                                    |                     +------------------------+
                                    +---------------------+
```

The diagram shows the main pieces: you use the admin portal to configure the gateway; Scalekit sits between the gateway and your directory; the gateway talks to Archestra to keep access in sync. Everything in this prototype runs **locally** by default (deploying to something like Render would exceed free-tier limits for the services involved).

## Tech stack

The system is built in layers: a **web layer** (the admin UI and gateway endpoints), an **identity/directory layer** (Scalekit for connecting to Okta, Entra, JumpCloud, etc.), and the **gateway logic** that maps directory events to Archestra provisioning and deprovisioning.

**Built with:** Deno (runtime), Hono (web server), Scalekit (identity and directory integration). The web UI may show “Hono!” on first load to confirm the server is up.

## Limitations

- **Local deployment only (for now).** The prototype is set up to run on your machine; putting it on Render or similar would hit free-tier limits for the services used.
- **Session token via environment variable.** Provisioning and deprovisioning rely on a session token passed in as an env var, because the existing platform APIs are geared toward application-level roles, not per-user role management.
- **Custom APIs where the platform didn’t fit.** Some behavior (e.g. creating users or changing roles per user) isn’t covered by the current public APIs, so this project implements its own integration layer.
- **Documentation gaps.** Some details are easy to miss—for example, the `Authorization` header must include the literal `"Bearer "` prefix (with a space). A few hours were lost to that alone; we’ll tighten the docs as we go.

## Roadmap (next future)

- Expand on to authorization, premissions based access control. An admin should be allow specific MCPs and A2A gateway alone to be used based on the role of the user
- Harden the admin portal and SCIM gateway for multi-org and clearer error handling.
- Improve documentation (including auth headers and env vars) so the next person doesn’t hit the same pitfalls.
- Revisit deployment options once we’re within free-tier or have a clear hosting path.

## Thanks

Thanks to the Archestra team for quick and helpful answers over Slack while building this.

---

<details>
<summary>Environment variables and running locally</summary>

The sync service and admin portal expect environment variables such as: `SCALEKIT_ENVIRONMENT_URL`, `SCALEKIT_CLIENT_ID`, `SCALEKIT_CLIENT_SECRET`, `SCALEKIT_WEBHOOK_SECRET`, `ARCHESTRA_APIKEY`, `ARCHESTRA_API_BASE_URL`, `ARCHESTRA_APP_BASE_URL`, `ARCHESTRA_SESSION_TOKEN`, `ORGANIZATION_ID`, and related optional overrides. Run tests with `deno task test`. See the repo for current env and run instructions.
</details>
