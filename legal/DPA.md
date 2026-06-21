# Data Processing Agreement

**Between:** [YOUR COMPANY NAME] ("**Processor**", "**we**") and the customer organisation identified in the applicable order form or signature block ("**Controller**", "**Customer**").

This Data Processing Agreement ("**DPA**") forms part of, and is incorporated into, the agreement between the Processor and the Customer for the provision of the GearTrack equipment-tracking application (the "**Service**"). It applies whenever the Processor processes Personal Data on behalf of the Customer in connection with the Service.

It is drafted to reflect UK GDPR and the Data Protection Act 2018, and the structure required by Article 28 UK GDPR.

> **Note:** This is a template reflecting GearTrack's actual technical architecture as of [DATE]. It should be reviewed by a solicitor before being executed with a customer, and the bracketed fields completed.

## 1. Definitions

Terms such as "**Personal Data**", "**Processing**", "**Data Subject**", "**Controller**", "**Processor**", and "**Personal Data Breach**" have the meanings given in UK GDPR. "**Sub-processor**" means any third party engaged by the Processor to process Personal Data in providing the Service.

## 2. Roles of the parties

The Customer is the Controller of Personal Data relating to its own personnel who use the Service (its employees/workers, "**Users**"). The Processor processes that Personal Data solely on behalf of, and under the documented instructions of, the Customer, as described in this DPA and the underlying services agreement.

## 3. Subject matter, duration, and nature of processing

See **Annex 1**.

## 4. Processor obligations

The Processor shall:

a. Process Personal Data only on the Customer's documented instructions (including those given through the Customer's use of the Service's own admin functions), unless required to do otherwise by law, in which case the Processor will inform the Customer before processing (unless prohibited from doing so).

b. Ensure that any person it authorises to process Personal Data (including the Processor's own platform-administration access, see Annex 2 §6) is subject to a duty of confidentiality.

c. Implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, as set out in **Annex 2**.

d. Not engage a Sub-processor without the Customer's prior general authorisation (granted under §5 below), and impose materially equivalent data-protection obligations on any Sub-processor it does engage.

e. Taking into account the nature of the processing, assist the Customer by appropriate technical and organisational measures, insofar as reasonably possible, in responding to requests from Data Subjects exercising their UK GDPR rights.

f. Assist the Customer in ensuring compliance with its obligations relating to security of processing, breach notification, and data protection impact assessments, taking into account the nature of processing and information available to the Processor.

g. At the Customer's choice, delete or return all Personal Data to the Customer after the end of the provision of the Service, and delete existing copies, except where retention is required by law (see §7).

h. Make available to the Customer information reasonably necessary to demonstrate compliance with this DPA, and allow for and contribute to audits, including inspections, conducted by the Customer or an auditor mandated by the Customer, subject to reasonable notice and confidentiality.

i. Notify the Customer **without undue delay, and in any event within 48 hours of becoming aware**, after becoming aware of a Personal Data Breach affecting the Customer's data, providing the information necessary for the Customer to meet its own breach-notification obligations (see the [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md) for the Processor's internal process).

## 5. Sub-processors

The Customer grants general authorisation for the Processor to engage the Sub-processor(s) listed in **Annex 3**. The Processor will give the Customer reasonable advance notice of any intended change (addition or replacement), allowing the Customer to object on reasonable data-protection grounds.

## 6. International transfers

Personal Data is stored at rest in the United Kingdom (see Annex 2). Limited, transient processing occurs in the United States as described in Annex 2 §3, safeguarded by the Sub-processor's Standard Contractual Clauses / UK International Data Transfer Addendum, incorporated by reference into the Sub-processor's own data processing terms.

## 7. Term, deletion, and survival

This DPA remains in effect for as long as the Processor processes Personal Data on the Customer's behalf under the Service. On termination, the Processor will, within 30 days, delete or return the Customer's Personal Data at the Customer's election, except for data the Processor is required to retain by law, or that remains in encrypted backups until those backups naturally expire (currently a 7-day rolling retention — see Annex 2 §4).

## 8. Liability

Each party's liability under this DPA is subject to the limitations and exclusions of liability set out in the underlying services agreement between the parties.

---

## Annex 1 — Details of Processing

| | |
|---|---|
| **Subject matter** | Provision of the GearTrack equipment-tracking application |
| **Duration** | For the term of the underlying services agreement, plus the deletion period in §7 |
| **Nature and purpose** | Storing and retrieving records of equipment items, kits, checkouts, reservations, and related user activity, to enable the Customer to track equipment custody |
| **Categories of Data Subjects** | The Customer's employees/workers who are given accounts on the Service |
| **Categories of Personal Data** | Name; email address; assigned role (admin/manager/user); records of which equipment a Data Subject has checked out or reserved, and when; an audit trail of administrative actions taken by the Data Subject within the Service |
| **Special category data** | None knowingly processed |

## Annex 2 — Technical and Organisational Security Measures

1. **Access control / tenant isolation**: Every database read is scoped to the Customer's organisation ID and enforced by server-side security rules (Cloud Firestore Security Rules), not solely by application logic — a query that is not provably scoped to the requesting user's organisation is rejected outright by the database.
2. **Account provisioning**: There is no open self-registration. Accounts are created only by an organisation's own administrator (or the Processor, for initial setup) via a server-side function. New accounts are activated through a single-use, time-limited password-reset link, never a plaintext emailed password.
3. **Infrastructure / sub-processor regions**: Data at rest (Cloud Firestore) is held in the **europe-west2 (London)** Google Cloud region. Serverless functions that handle account-creation requests execute in the **us-central1 (United States)** region, meaning Personal Data submitted during account creation passes briefly through US-based compute before being persisted in the UK. Authentication credentials (Firebase Authentication) are held in Google's global authentication infrastructure, not pinned to a single region.
4. **Backup and recovery**: Automated daily backups of the production database are taken and retained on a 7-day rolling basis, enabling recovery from accidental data loss or corruption.
5. **Encryption**: Data is encrypted in transit (TLS) and at rest, as provided by the underlying Google Cloud infrastructure.
6. **Administrative access**: The Processor retains a "platform admin" technical capability to access any Customer's data on the platform, used exclusively for customer support, troubleshooting, and platform administration (e.g. provisioning a new Customer organisation). This access is not currently individually audit-logged at the infrastructure level; logged-in administrative actions taken through the application's own admin interface are recorded in the application's audit log.
7. **No file storage**: The Service does not currently store uploaded photos, documents, or other files; this capability exists in the Service's underlying code but is disabled and carries no live data.

## Annex 3 — Sub-processors

| Sub-processor | Service provided | Location of processing |
|---|---|---|
| Google Cloud / Firebase (Google Ireland Limited / Google LLC) | Database hosting (Cloud Firestore), authentication, serverless compute | Primarily europe-west2 (London); transient processing in us-central1 (United States) for account-creation requests |
