# QA plan

Use this as a release smoke checklist and as the basis for later `node:test` API tests. Map actions, fields, routes, role permissions, and exact status codes to PLAN.md and API.md as those contracts are finalized. Each rejected request must leave persisted data unchanged and must not expose private records.

## Fixtures

Use a fresh temporary SQLite database per test run, never the real database. Seed one owner, staff member, two PTs and two members with distinct credentials; give one member a valid membership and the other an expired membership. Seed PT appointments at known times, plus a payment and attendance record where needed. Use fixed dates and times, explicitly setting the application timezone for membership boundary checks; clean up the temporary database and stop the server after the run. Exercise the actual HTTP API with built-in `fetch` and `node:test`, logging in separately for each role.

## Acceptance matrix

| Area | Action and boundary | Expected result |
| --- | --- | --- |
| Owner | Sign in and exercise each owner action defined in the plan, including viewing the relevant operational records. | Allowed actions succeed and show the correct records; invalid credentials fail. |
| Staff | Sign in, perform the documented member, membership, payment and attendance operations. Try an owner-only operation. | Assigned actions succeed; owner-only operation is forbidden and makes no change. |
| PT | Sign in and view assigned appointments and member details needed for those appointments. Attempt to access another PT's private appointments or member data. | Assigned data is visible; unrelated private data is denied or omitted. |
| Member | Sign in, view own membership, attendance and bookings, and perform documented self-service booking. Attempt another member's records by changing an ID. | Own data and permitted actions work; another member's data is denied or omitted. |
| Membership | Check in a member with a valid membership, then one with an expired membership. Test the exact start and end boundaries under the documented date/time rules. | Valid membership permits attendance; expired or not-yet-valid membership does not. Boundary results match the documented inclusive/exclusive rules. |
| Attendance | Submit a check-in twice for the same member and attendance period, including two near-simultaneous requests. | At most one attendance record exists; the duplicate is rejected or reported as already recorded. A different eligible period can be recorded. |
| PT booking | Book an available slot, then try an overlapping slot for the same PT, including a simultaneous request. Try adjacent non-overlapping slots and a slot for another PT. | Only one overlapping booking for a PT succeeds; adjacent slots and an available different PT work. Rejections do not create bookings. |
| Payments | Record an allowed payment in integer VND and read it back. Try a fractional amount, negative amount, non-number and a value outside the supported safe integer range. | Exact integer amount persists without rounding; invalid values are rejected. Verify zero against the documented payment rule. |
| Authentication and authorization | Call each protected API without credentials, with invalid credentials, and with a signed-in role lacking permission; attempt direct ID substitution. | Unauthenticated requests receive 401; authenticated but forbidden requests receive 403 or the documented non-disclosing 404. No protected data or mutation leaks. |
| Required fields | For every create/update operation, omit each required field and submit empty or malformed values; repeat with valid values. | Invalid requests receive a client error identifying the problem and persist nothing; valid requests succeed. |
| Mobile UI | At 320 px and a typical phone width, sign in as each role and complete its main documented workflow using keyboard and touch-sized controls. | Text and controls remain usable, no page-level horizontal overflow hides content, labels and errors are clear, and focus remains visible. |
| Persistence | Create a membership, payment, attendance and booking; stop and restart the backend against the same database. | Records and their exact values remain available to authorized users; duplicates and conflicts are still prevented. |
| Build and start | Install only the project's declared dependencies, run its documented build, start the backend and UI using the documented commands, and load the app. | Commands exit successfully or remain running as intended; the UI loads and can reach the API. |

## Smallest checks

- Once tests exist, run `node --test` from the project root; keep API and database checks in a small number of test files using Node's built-in test and assertion modules. No test code is part of this plan.
- Run the actual build and start commands specified by the project once they exist; do not assume npm script names before they are defined. Run the mobile and role workflows manually in a browser.
- Record failures with role, request or UI steps, expected and actual result, and database state. Do not use production credentials or data for fixtures.
