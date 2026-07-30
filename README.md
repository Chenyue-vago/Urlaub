# Urlaubsverwaltung — Vacation Manager

Request and manage your vacation days online. Employees submit leave requests,
admins approve or reject them, and everyone can see who's off on the shared team
calendar. Everyone gets a single yearly allowance of **28 vacation days**
(pro-rated for your first year), and the app handles the German specifics
automatically — your state's public holidays and weekends are never counted, and
any unused days carry over into the next year.

## Open the app

👉 **https://chenyue-vago.github.io/Urlaub/**

Sign in with your company email (`@vago-solutions.ai`). The first time you sign
in, an account is created for you automatically.

## For employees

**Set up your account (first login)**
On your first sign-in you'll be asked for your **employment start date**. This is
used to pro-rate your vacation entitlement for your joining year, so enter it
accurately.

**See your balance**
Your dashboard shows, for the selected year, your total available days, how many
you've used or reserved, and how many are left. Your total is the 28-day yearly
allowance **plus** any days carried over from the previous year (e.g. 28 + 9
carried over = 37 available). Carried-over days are marked as such and, being
use-it-or-lose-it, are always spent first.

**Carry-over rules**
Days you don't use roll into the next year and must be taken by **December 31**
of that year, or they expire. Carry-over does not stack indefinitely: only your
regular 28-day allowance rolls forward — days that were themselves carried over
don't carry a second time.

**Request vacation**
1. Click **Request Vacation** and pick your start and end dates.
2. Submit. You only choose the dates — there are no vacation "types" to pick.
   The system draws from your perishable carried-over days first, then your
   regular allowance, so use-it-or-lose-it days are never wasted.
3. Your request appears as **pending** and the days are reserved from your
   balance right away. Days that consume carry-over are labelled **Carry-over**
   in your records so it's clear which are which.

Notes:
- Public holidays and weekends in your state are not counted as vacation days.
- You can't request dates that overlap an existing pending or approved request.

**Cancel a request**
You can cancel a request that hasn't started yet — whether it's still pending or
already approved — and the days are released back to your balance. Once a
vacation has started (by its start date) it can no longer be cancelled.

**Tidy up your dashboard**
Cancelled entries can be hidden/removed from your own dashboard list. This only
affects your view — the record stays intact for auditing.

**Team calendar**
The **Team** view is a month calendar showing who is off and when, so you can
plan around your colleagues.

## For admins

Admins get everything above, plus:

- **Approvals queue** — review pending requests and **approve** or **reject**
  them. Approving finalizes the reserved days; rejecting releases them. A request
  that crosses a year boundary is shown as one linked group and decided together.
- **Users** — see each person's leave records (valid pending/approved leave;
  rejected entries are kept for audit, cancelled ones are excluded).
- **Audit log** — every approve, reject, and cancel is recorded. Click a row to
  see who did what, on which dates.

New users always start as a regular **member**. Becoming an admin is done by an
existing admin (or, for the very first admin, directly in the database).

## Languages

The interface is available in **English** and **Chinese (中文)**.

---

Running the app yourself or deploying it? See **[README-DEV.md](README-DEV.md)**.
