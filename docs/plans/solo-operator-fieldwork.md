# Plan: Owner/admin doing their own fieldwork

Status: done, 2026-09-27.

## The problem

Found during a full signup-to-payment dry run: a business where the owner
does the work themselves (very common — most of the beta users are sole
operators) had no way to assign a job to themselves. Assignment only offered
`role: TECHNICIAN` memberships, and technicians log in with phone + PIN,
completely separately from the owner's email + password. The only way
through was to add the owner a second time as a "technician", with a second
login, for the same person — confusing and something no one would guess to
do on their own.

`Membership` already has `@@unique([tenantId, userId])`, so a second
membership for the same person in the same business isn't even possible —
confirming a second field, not a second membership, was the only real fix.

## What was built

1. **`Membership.doesFieldwork`** (boolean) — an OWNER/ADMIN/DISPATCHER
   flagged this way can be assigned to visits, without a technician login.
2. **Signup asks "Do you do the work yourself?"** — *Just me* / *Me and a
   team* / *No, I manage*. The first two set `doesFieldwork` on the owner's
   own membership immediately, no extra step needed.
3. Every place that offered technicians for assignment now also offers
   anyone flagged `doesFieldwork`: job page, schedule page, recurring job
   setup, the visit-assignment validator, and the dashboard's field-tech
   count. Only the two places that actually create a technician *login*
   (signup's own account, and "Add a technician" on the Team page) are
   unchanged — those are genuinely about a phone+PIN account.
4. **`/my-day`** — the same day view a technician gets (call, navigate, on
   my way, arrived), reachable from a "My day" sidebar link that only shows
   when `doesFieldwork` is true. No separate login; it's just another page
   inside the normal office chrome.
5. Team page: a toggle to turn this on or off for anyone who isn't a
   technician (e.g. a sole operator who later hires their first tech and
   stops doing fieldwork themselves).

## Tested

Signed up as a solo pool-cleaning business ("Just me"), confirmed: exactly
one team member existed (no second login), the job page's technician
checklist offered her directly, a visit assigned to her showed up on
`/my-day`, and turning the Team-page toggle off correctly removed the
sidebar link and blocked direct navigation to `/my-day`.
