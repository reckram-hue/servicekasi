# Local test accounts

For the local development database only. Not real people; never use these anywhere but localhost.

Created automatically by `npm run db:seed` (safe to re-run any time, including after `prisma migrate reset`).

| Who | Login | Secret |
|---|---|---|
| Owner of "Test Plumbing" | owner@servicekasi.test | password: `TestOwner-2026!` (authenticator app already switched on) |
| Technician "Sipho Test" | +27 82 555 0101 | PIN: `4821` |

## Skip typing all that in — instant login while testing

While `npm run dev` is running, these two links log you in immediately, no
password/PIN/code needed:

- http://localhost:3000/api/dev/login-as/owner
- http://localhost:3000/api/dev/login-as/technician

They only work in local development (`NODE_ENV=development`) — visiting them
on a real deployed site does nothing. See
[route.ts](../src/app/api/dev/login-as/[role]/route.ts).
