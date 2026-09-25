# RBAC System

**A Node.js/Express identity and access management (IAM) backend implementing Role-Based Access Control (RBAC) with JWT authentication, bcrypt password hashing, and a normalized five-table relational schema on SQLite.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite&logoColor=white)](https://github.com/WiseLibs/better-sqlite3)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Built to demonstrate the same access-control patterns used in enterprise IAM platforms (Okta, Azure AD, AWS IAM, CrowdStrike Falcon Identity Protection) — least-privilege authorization, normalized role/permission modeling, and secure credential/token lifecycle handling.

## Project stats

| | |
|---|---|
| **Tables** | 5 (`users`, `roles`, `permissions`, `user_roles`, `role_permissions`) |
| **API endpoints** | 19 across auth, users, roles, and permissions |
| **Source files** | 14 JS modules, ~780 lines |
| **Auth model** | JWT access + refresh tokens, bcrypt (12 salt rounds) |
| **Seeded roles** | 3 (admin, manager, viewer) with distinct permission sets |
| **Dependencies** | 8 production, 1 dev |

## Table of contents

- [Features](#features)
- [Data model](#data-model)
- [Architecture](#architecture)
- [Setup](#setup)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Tech stack](#tech-stack)
- [Roadmap](#roadmap)
- [License](#license)

## Features

- **JWT authentication** — short-lived access tokens + long-lived refresh tokens
- **Bcrypt** password hashing (configurable salt rounds)
- **Five-table relational RBAC schema**: `users`, `roles`, `permissions`,
  `user_roles` (junction), `role_permissions` (junction)
- **Fine-grained permission checks** (`resource:action`, e.g. `users:delete`)
  in addition to coarse role checks
- **Middleware-based enforcement** — `requirePermission()` / `requireRole()`
  guards on every protected route
- **Rate limiting** on auth endpoints, `helmet` security headers, `cors`
- **Seed data** with three demo accounts (admin / manager / viewer)

## Data model

```
users ──────┐                       ┌────── permissions
             │                       │
             ▼                       ▼
        user_roles ───────────► role_permissions
             │                       │
             ▼                       ▼
            roles ◄──────────────────┘
```

| Table              | Purpose                                              |
|--------------------|-------------------------------------------------------|
| `users`            | Accounts: username, email, bcrypt password hash      |
| `roles`            | Named roles (admin, manager, viewer, ...)             |
| `permissions`      | Fine-grained grants in `resource:action` form         |
| `user_roles`       | Many-to-many junction: which users hold which roles   |
| `role_permissions` | Many-to-many junction: which roles hold which perms   |

A user's effective permissions are resolved at login time by joining
`user_roles → roles → role_permissions → permissions`, de-duplicated, and
embedded directly in the JWT — so authorization checks on every request are
just an array lookup, not a database round trip.

## Architecture

```
Client
  │
  │  POST /api/auth/login  { username, password }
  ▼
Express router ──► auth.controller.js
                       │  bcrypt.compareSync()
                       │  SQL join: user_roles → roles → role_permissions → permissions
                       ▼
                  signAccessToken({ sub, roles, permissions })
                       │
  ◄────────────────────┘  { accessToken, refreshToken }

Client
  │
  │  GET /api/users   Authorization: Bearer <token>
  ▼
auth.middleware.js  ──►  verifies JWT signature + expiry
  │
  ▼
rbac.middleware.js  ──►  requirePermission('users:read')
  │                        checks decoded.permissions[] (no DB hit)
  ▼
user.controller.js ──► 200 { users: [...] }  or  403 Forbidden
```

Every protected route runs through two middleware layers in sequence:
`authenticate` (is this a valid, unexpired token?) then `requirePermission` /
`requireRole` (does this identity's resolved permission set satisfy the
route's requirement?). Controllers never see a request that hasn't already
cleared both.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and set real JWT secrets before running in production
npm run seed     # creates data/rbac.db, schema, and demo accounts (also runs automatically on start)
npm start        # or: npm run dev (nodemon)
```

Server runs on `http://localhost:4000` by default.

### Demo accounts (seeded automatically)

| Username   | Password       | Role    |
|------------|----------------|---------|
| `admin`    | `Passw0rd!123` | admin   |
| `manager1` | `Passw0rd!123` | manager |
| `viewer1`  | `Passw0rd!123` | viewer  |

## API Reference

### Auth — `/api/auth`

| Method | Endpoint    | Auth required | Description                          |
|--------|-------------|----------------|---------------------------------------|
| POST   | `/register` | No             | Create a new user (defaults to `viewer`) |
| POST   | `/login`     | No             | Returns `accessToken` + `refreshToken`   |
| POST   | `/refresh`   | No (refresh token in body) | Issues a new access token   |
| GET    | `/me`        | Yes            | Returns the decoded token payload        |

**Login example:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Passw0rd!123"}'
```

### Users — `/api/users` (all require a valid access token)

| Method | Endpoint              | Required permission | Description              |
|--------|------------------------|----------------------|---------------------------|
| GET    | `/`                    | `users:read`         | List all users            |
| GET    | `/:id`                 | `users:read`         | Get one user               |
| PUT    | `/:id`                 | `users:write`        | Update email / active flag |
| DELETE | `/:id`                 | `users:delete`       | Delete a user               |
| POST   | `/:id/roles`           | `users:write`        | Assign a role to a user     |
| DELETE | `/:id/roles/:roleId`   | `users:write`        | Revoke a role from a user   |

### Roles — `/api/roles`

| Method | Endpoint                          | Required permission   | Description                |
|--------|-----------------------------------|------------------------|------------------------------|
| GET    | `/`                               | `roles:read`           | List roles + their permissions |
| POST   | `/`                               | `roles:write`          | Create a role                  |
| PUT    | `/:id`                            | `roles:write`          | Update a role's description    |
| DELETE | `/:id`                            | `roles:delete`         | Delete a role                  |
| POST   | `/:id/permissions`                | `permissions:assign`   | Grant a permission to a role   |
| DELETE | `/:id/permissions/:permissionId`  | `permissions:assign`   | Revoke a permission from a role|

### Permissions — `/api/permissions`

| Method | Endpoint | Required permission | Description       |
|--------|----------|----------------------|---------------------|
| GET    | `/`      | `permissions:read`   | List all permissions |
| POST   | `/`      | `permissions:assign` | Create a new permission |
| DELETE | `/:id`   | `permissions:assign` | Delete a permission |

## Authenticated request example

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Passw0rd!123"}' | jq -r .accessToken)

curl http://localhost:4000/api/users \
  -H "Authorization: Bearer $TOKEN"
```

## Security notes

- Passwords are hashed with bcrypt (default 12 salt rounds) — never stored
  or logged in plaintext.
- Access tokens are short-lived (15m default); refresh tokens (7d default)
  are used to mint new access tokens without re-sending credentials.
- Foreign keys and `ON DELETE CASCADE` on both junction tables keep the
  role/permission graph consistent when a user or role is removed.
- Rate limiting is applied to `/api/auth/*` to slow down credential
  stuffing / brute-force attempts.
- Rotate `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` and never commit `.env`.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 18+ | LTS, native ESM/CJS interop |
| Framework | Express 4 | Minimal, explicit middleware chain — easy to show the auth → RBAC → controller pipeline |
| Database | SQLite via `better-sqlite3` | Synchronous API keeps the permission-resolution join simple to read; zero external DB dependency for local dev |
| Auth | `jsonwebtoken` | Stateless access/refresh tokens, no server-side session store |
| Password hashing | `bcrypt` | Industry-standard adaptive hashing, salted per-password |
| Hardening | `helmet`, `cors`, `express-rate-limit` | Security headers, cross-origin policy, brute-force throttling on `/api/auth/*` |

## Roadmap

- [ ] Automated test suite (Jest + Supertest) covering auth flows and permission boundaries
- [ ] Audit log table recording permission grants/revocations and failed auth attempts
- [ ] Attribute-based conditions on top of RBAC (e.g. ownership checks: "can edit own profile")
- [ ] Dockerfile + docker-compose for one-command local spin-up
- [ ] OpenAPI/Swagger spec generated from the route definitions
- [ ] Optional Postgres adapter for production deployments

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md)
for local setup and coding conventions.

## License

Released under the [MIT License](./LICENSE).

---

Built as a portfolio project demonstrating practical IAM engineering: a
normalized RBAC schema, least-privilege authorization middleware, and
secure credential/token lifecycle management — the same patterns used in
enterprise identity platforms (Okta, Azure AD, AWS IAM, CrowdStrike Falcon
Identity Protection).
