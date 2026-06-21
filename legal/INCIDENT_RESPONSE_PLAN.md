# GearTrack Incident Response Plan

**Last updated: [DATE]**

This is an internal operational playbook, not a customer-facing legal document. It describes what to actually do if something goes wrong with GearTrack's security or data integrity. Written for a single-operator team ([YOUR NAME]) — assign roles to specific people if the team grows.

## 1. Scope

Covers: suspected or confirmed unauthorised access to Customer data, cross-organisation data leakage, account compromise, accidental data loss/corruption, and availability incidents (the Service being down or seriously degraded).

## 2. Severity levels

| Level | Definition | Example |
|---|---|---|
| **P1 — Critical** | Confirmed Personal Data Breach: data from one organisation was actually exposed to another, or to an unauthorised party | A user from Org A could see Org B's items/checkouts |
| **P2 — High** | Suspected breach, or a confirmed vulnerability with no evidence of actual exploitation yet | A security rule gap is found (like the Storage rules gap found 2026-06-21) before any exploit is confirmed |
| **P3 — Medium** | Data loss/corruption affecting one organisation, no confidentiality impact | A batch operation accidentally deletes/overwrites the wrong records |
| **P4 — Low** | Availability issue, no data confidentiality/integrity impact | Cloud Functions outage, GitHub Pages deploy failure |

## 3. Detection — what to watch for

- A Customer or user reports seeing data that isn't theirs.
- Unexpected entries in Firestore (e.g. an `organizations` doc appearing that nobody created — check `firebase firestore:databases:list` / Firestore Console).
- Cloud Functions error logs showing repeated `permission-denied` or unexpected `auth/*` errors from a single account: `firebase functions:log --only createOrganization,createOrgUser,backfillDefaultOrg`.
- Unusual entries in the application's own Audit Log page (`/activity`).
- A spike in Firebase Authentication sign-ins from an unfamiliar location/IP (Firebase Console → Authentication).

## 4. Immediate response (first hour)

1. **Don't panic-delete anything.** Daily backups exist (7-day retention), but the priority is containment, not cleanup.
2. **Contain.**
   - Account compromise → disable the specific account: Firebase Console → Authentication → find user → Disable account. (There is no CLI command for this — see note in §7.)
   - Vulnerable security rule → fix and redeploy immediately: `firebase deploy --only firestore:rules` (or `--only storage` for Storage rules).
   - Vulnerable Cloud Function → either fix and redeploy, or temporarily make it reject all calls by deploying a version that throws `HttpsError('unavailable', ...)` unconditionally, buying time to fix properly.
3. **Snapshot the evidence before changing anything you can.** Export current Auth state for later analysis: `firebase auth:export incident-$(date +%Y%m%d).json`. Note exact timestamps of anything suspicious from Cloud Functions logs.
4. **Classify severity** using the table in §2.

## 5. Investigation

1. Identify scope: which organisation(s) and which collections/records were actually exposed or affected? Cross-reference:
   - The Audit Log (`auditLog` collection) for the affected org(s).
   - Cloud Functions logs around the relevant time window.
   - Firebase Authentication custom claims for any accounts involved (`firebase auth:export` and inspect `customAttributes`).
2. Establish root cause — is this an application bug (e.g. an unscoped query), a security rules gap (e.g. the Storage rules issue found during the 2026-06 compliance review), or genuine credential compromise (phished/leaked password)?
3. Confirm whether the issue is still live/exploitable, or already contained by step 4 above.

## 6. Notification obligations

| Who | Trigger | Timeline |
|---|---|---|
| **ICO** | Any Personal Data Breach posing a risk to individuals' rights and freedoms (P1, sometimes P2) | Within **72 hours** of becoming aware, via [ico.org.uk](https://ico.org.uk/for-organisations/report-a-breach/) |
| **Affected Customer organisation(s)** | Any Personal Data Breach affecting their data (per the [DPA](./DPA.md) §4(i)) | **Without undue delay**, and in any case within **48 hours** of becoming aware |
| **Affected individuals directly** | Only if the breach is likely to result in **high risk** to them (e.g. credential exposure enabling account takeover) | Without undue delay, alongside or after Customer notification |

Keep a record of every breach regardless of whether it met the notification threshold — the ICO can ask to see this even for breaches that weren't reported.

A short factual incident summary for a Customer notification should cover: what happened, when, what data/which of their users were affected, what's been done to contain it, and what they should do (e.g. "no action needed" or "ask affected users to reset their password").

## 7. Recovery

- **Data loss/corruption (P3)**: restore from the relevant daily backup. List available backups: `firebase firestore:backups:list --location=europe-west2`. Restore (creates a **new** database — does not overwrite the live one in place, so plan the cutover): `firebase firestore:databases:restore --source-backup=<backup-name> --destination-database=<new-db-id>`.
- **Confirmed cross-tenant leak (P1)**: after fixing the root cause, re-run the cross-org isolation test (create a throwaway second org, confirm zero visibility both directions) before declaring the incident closed — see the procedure used 2026-06-21.
- **Compromised account**: disable it, force a password reset via a fresh reset link, and review the Audit Log for anything it did while compromised.

## 8. Post-incident review

For anything P2 or above, write a short note (a few bullet points is fine) covering: what happened, root cause, what fixed it, and whether this plan or the codebase needs a change to prevent recurrence. Add the fix as a memory/roadmap item if it reveals a broader pattern (e.g. "Storage rules were missed when Firestore rules were scoped — check *all* rule files next time, not just Firestore's").

## 9. Known gaps in this process (be honest about these)

- No CLI/scripted way to disable a single Firebase Auth user or force-revoke their sessions instantly — currently a manual Console click. For a true P1 with many affected accounts, this doesn't scale; revisit if the user base grows materially.
- Single operator — no second person to catch mistakes or share the load during an active incident. Acceptable at current scale (~10 customers), but worth revisiting before scaling further.
- No automated alerting — detection currently relies on someone noticing (a Customer report, or manually checking logs). Consider a Cloud Monitoring alert on Cloud Functions error rate if this becomes a recurring concern.
