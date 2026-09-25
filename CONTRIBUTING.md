# Contributing

Thanks for taking a look at this project. It started as a portfolio piece,
but issues and pull requests are welcome.

## Local setup

```bash
git clone https://github.com/<your-username>/rbac-system.git
cd rbac-system
npm install
cp .env.example .env   # fill in your own JWT secrets
npm run seed            # creates data/rbac.db with demo accounts
npm run dev              # starts the server with nodemon
```

## Project conventions

- **Controllers stay thin.** Business logic and SQL live in the controller;
  routes only wire up middleware and call the controller function.
- **Every protected route** goes through `authenticate` first, then
  `requirePermission()` or `requireRole()` — never skip straight to the
  controller for anything touching user, role, or permission data.
- **Permissions are named `resource:action`** (e.g. `users:delete`). If you
  add a new resource, follow that pattern so `requirePermission()` checks
  stay consistent.
- **No raw SQL string concatenation.** Always use `better-sqlite3`'s
  parameterized `db.prepare(...).run(...)` / `.get(...)` / `.all(...)`.
- **Don't commit `.env` or `data/*.db`** — both are gitignored for a reason;
  the seed script regenerates the database from scratch.

## Submitting a change

1. Fork the repo and create a branch off `main`.
2. Keep commits focused — one logical change per commit.
3. If you touch auth or RBAC middleware, describe in the PR what you tested
   manually (there's no automated test suite yet — see the Roadmap in the
   README if you'd like to help add one).
4. Open a pull request with a short description of what changed and why.

## Reporting issues

Open a GitHub issue with steps to reproduce, what you expected, and what
actually happened. For security-relevant bugs (auth bypass, permission
escalation), please open the issue with minimal detail and mention that it's
security-sensitive so it can be discussed privately first.
