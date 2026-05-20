Solution Design — Solution-Architect · 5/20/2026, 3:59:06 PM
6.1 Solution Overview
Solution purpose
Implement a Dynamics 365 Customer Service, case-centric Dataverse solution to manage client organizations and their migration-related service requests. The design uses native Dataverse and Dynamics 365 Customer Service patterns first: Account for client organizations, Contact for primary people, and Case (incident) for work/request tracking. This aligns with Microsoft guidance to prefer standard entities/CDM-aligned structures and to use Case as the core service record.

Overall structure

Account = client organization
Contact = primary client contact
Case (incident) = migration/service request
Queue = operational work distribution
SLA / SLA KPI = response and resolution monitoring
System User / Team = ownership and assignment
Design principle

Extend standard tables before creating custom tables.
Use standard Customer Service case lifecycle, queues, forms, related section, and SLA capabilities.
Introduce only minimal custom fields; no custom tables are required for the current scope.
6.2 Entity Design
Entity 1: Client
Business name: Client
Target Dataverse table: account
Description: Organization receiving migration or support services.
Justification: Client is an organization-level master record and maps directly to standard Account. Microsoft guidance favors standard entities aligned to the Common Data Model rather than repurposing or creating unnecessary custom tables.
Entity 2: Primary Client Contact
Business name: Primary Client Contact
Target Dataverse table: contact
Description: Named person associated with the client organization for communications.
Justification: Contact email/phone should not be stored only as denormalized account fields if a person record may be needed for future service interactions. Customer Service supports account/contact relationships and customer cards on case forms.
Entity 3: Case
Business name: Case
Target Dataverse table: incident
Description: Migration task, service request, or issue logged for a client.
Justification: For request-based scenarios, the design must use standard Case. Customer Service provides native case forms, case relationships, SLA tracking, queues, and related activities.
Supporting Standard Entities
Queue
Target table: queue
Purpose: Organize, prioritize, and monitor pending case work.
Justification: Native Customer Service queue pattern for cases and activities.
SLA / SLA KPI Instance
Target tables: standard SLA-related entities
Purpose: Track first response and resolution commitments on cases.
Justification: Native case SLA functionality is standard in Customer Service. The case form includes SLA information.
System User / Team
Target tables: systemuser, team
Purpose: Ownership for accounts and cases; optional team-based queue management.
Justification: Owner fields should normalize against platform security principals rather than remain free text.
6.3 Field Design
Naming Standard
Publisher prefix: mig
Custom schema prefix: mig_
Custom columns use lowercase schema names with underscores.
Display names remain business-friendly.
Account (account) Field Design
Display Name	Schema Name	Type	Standard/Custom	Required	Description
Account Name	name	Text	Standard	Yes	Client organization name.
Account Number	accountnumber	Text	Standard	Yes	Stores source ClientID; configured as alternate key.
Main Phone	telephone1	Phone	Standard	No	Primary client contact phone from source if no contact record is available.
Email Address	emailaddress1	Email	Standard	No	Fallback organization-level email.
Industry	industrycode or mig_industrytext	Choice or Text	Mixed	No	Use standard industrycode if source values fit; otherwise use mig_industrytext during migration stabilization.
Primary Contact	primarycontactid	Lookup(Contact)	Standard	No	Links client to main person contact.
Relationship Owner	ownerid	Owner	Standard	Yes	Account manager as normalized user/team owner.
Source Client ID	mig_sourceclientid	Text	Custom	Yes	Exact source identifier preserved for traceability if separate from account number is required.
Legacy Account Manager Name	mig_legacyaccountmanagername	Text	Custom	No	Raw source manager name preserved when user resolution is imperfect.
Design decision:

ClientID is stored in both Account Number for business usability and in mig_sourceclientid for immutable migration traceability.
Account Manager maps primarily to ownerid; raw source value retained in mig_legacyaccountmanagername when needed.
Industry should start as text if source values are not governed; later can be converted to controlled choice once values are standardized.
Contact (contact) Field Design
Display Name	Schema Name	Type	Standard/Custom	Required	Description
Full Name	fullname	Text	Standard	Yes*	Generated if a person name is available; else derived placeholder.
Parent Customer	parentcustomerid	Customer Lookup	Standard	Yes	Links contact to client account.
Email	emailaddress1	Email	Standard	No	Primary contact email from source.
Business Phone	telephone1	Phone	Standard	No	Primary contact phone from source.
Contact Role	mig_contactrole	Choice	Custom	No	Default value = Primary Client Contact.
Source Client ID	mig_sourceclientid	Text	Custom	Yes	Links contact provenance back to source client row.
Design decision:
Because source data provides only contact email and phone, not a person name, one contact may be created per client using generated name format:
<Client Name> Primary Contact.
This keeps Customer Service customer/contact features usable while preserving current source limitations.

Case (incident) Field Design
Display Name	Schema Name	Type	Standard/Custom	Required	Description
Title	title	Text	Standard	Yes	Case summary/title.
Customer	customerid	Customer Lookup	Standard	Yes	Links case to Account.
Case Number	ticketnumber	Auto/Text	Standard	System	Native human-readable case number. Source value stored separately.
Subject	subjectid	Lookup(Subject)	Standard	No	Optional future classification; not required for initial migration.
Case Origin	caseorigincode	Choice	Standard	No	Set default to Data Migration / Manual import equivalent.
Priority	prioritycode	Choice	Standard	Yes	Maps source Priority to standard Case Priority.
Status Reason	statuscode	Choice	Standard	Yes	Maps source Status to active/resolved/canceled model.
State	statecode	Choice	Standard	System	Derived from status reason.
Created On	createdon	DateTime	Standard	System	Set from source during migration if tooling supports override; otherwise store original in custom field below.
Owner	ownerid	Owner	Standard	Yes	Case owner resolved to user/team.
Description	description	Multiline Text	Standard	No	Optional future expansion; not supplied by source.
Source Case ID	mig_sourcecaseid	Text	Custom	Yes	Exact source CaseID; alternate key.
Source Case Number	mig_sourcecasenumber	Text	Custom	No	Original source human-readable case reference.
Source Created Date	mig_sourcecreateddate	Date Only	Custom	Yes	Converted from numeric YYYYMMDD; retained even if createdon cannot be backfilled.
Migration Type	mig_migrationtype	Choice	Custom	No	Migration category such as Cloud/Hybrid.
Estimated Hours	mig_estimatedhours	Decimal Number(10,2)	Custom	No	Planned effort.
Risk Level	mig_risklevel	Choice	Custom	No	Delivery/migration risk classification.
Legacy System Reference	mig_legacysystemreference	Text	Custom	No	External legacy tracking reference.
Legacy Owner Name	mig_legacyownername	Text	Custom	No	Raw owner string preserved if not resolvable to a system user.
Data Load Batch	mig_dataloadbatch	Text	Custom	No	Migration batch/run identifier for repeatable imports.
Migration Notes	mig_migrationnotes	Multiline Text	Custom	No	Validation/error notes from migration.
Queue-related Configuration Fields
No custom queue fields required in phase 1.

Option Set / Choice Design
mig_migrationtype
Initial values:

Cloud
Hybrid
On-Premises
Rehost
Refactor
Unknown
mig_risklevel
Initial values:

Low
Medium
High
Critical
Unknown
mig_contactrole
Initial values:

Primary Client Contact
Billing Contact
Technical Contact
Other
Implementation note:
Because allowed source values are not fully confirmed, choice sets must be created with an Unknown value to support first-pass migration without failure.

6.4 Relationships
Relationship 1
Source entity: Account
Target entity: Case
Type: One-to-many
Implementation detail: Standard Case customerid lookup points to Account. One account can have many cases.
Relationship 2
Source entity: Account
Target entity: Contact
Type: One-to-many
Implementation detail: Standard Contact parentcustomerid links contacts to account.
Relationship 3
Source entity: Account
Target entity: Contact
Type: One-to-one logical usage
Implementation detail: Account primarycontactid points to the designated main contact.
Relationship 4
Source entity: Queue
Target entity: Case
Type: Operational association
Implementation detail: Cases routed into queues using native Customer Service queue capability. Queues are standard containers for work requiring action.
Relationship 5
Source entity: SLA / SLA KPI Instance
Target entity: Case
Type: One-to-many operational
Implementation detail: SLA records applied to cases; KPI instances displayed on the case SLA tab.
Relationship 6
Source entity: System User / Team
Target entity: Account and Case
Type: Ownership
Implementation detail: ownerid on both tables. Accounts normally owned by account managers; cases owned by service agents or teams.
6.5 Case Management Design
Case Usage
All service requests, migration work items, and issues are implemented as Cases. This follows the mandatory case-centric requirement and native Customer Service approach. Case forms support summary/details/relationships/SLA/related information natively.

Case Lifecycle
Lifecycle stages

New
Triage
In Progress
Waiting for Customer
Waiting for Internal Dependency
Resolved
Canceled
State / Status Model
Use standard Case state model with controlled status reasons:

Active State
New
Triage
In Progress
Waiting for Customer
Waiting for Internal Dependency
Resolved State
Resolved
Canceled State
Canceled
Design decision:
Source Status values will be mapped into this controlled target list. Free-text source statuses are not retained as operating values; if needed for audit, store the original value in mig_migrationnotes during load.

Priority Model
Use standard case priority (prioritycode) with the following operational values:

Low
Normal
High
Critical
Mapping rule: if source contains only 3-level priority, map:

Low → Low
Medium/Normal → Normal
High/Urgent → High
Unmapped values default to Normal and are noted in migration exceptions.
SLA Definition (Conceptual)
Implement one standard SLA applicable to migration cases:

First Response KPI
Critical: 4 business hours
High: 8 business hours
Normal: 1 business day
Low: 2 business days
Resolve KPI
Critical: 1 business day
High: 3 business days
Normal: 5 business days
Low: 10 business days
This is a deployment-ready default. SLA can be refined later without schema changes. Native SLA support is recommended.

Queue Design
Create these queues:

Migration Triage Queue
Cloud Migration Queue
Hybrid Migration Queue
High Risk Queue
General Service Queue
Queues are standard Customer Service workload containers.

Routing Approach
Use rule-based routing, no custom code:

New imported case enters Migration Triage Queue.
If mig_migrationtype = Cloud, route to Cloud Migration Queue.
If mig_migrationtype = Hybrid, route to Hybrid Migration Queue.
If mig_risklevel in (High, Critical), override route to High Risk Queue.
Otherwise route to General Service Queue.
This is compatible with native routing / queue patterns and avoids unnecessary customization.

Assignment Model
Accounts owned by Account Managers.
Cases initially queue-owned operationally, then assigned to a user or team.
If source Owner resolves to an existing Dataverse user, assign directly.
If not resolved, assign case to queue/team and preserve raw owner name in mig_legacyownername.
Escalation Concept
No custom workflow code required in phase 1.

Escalate by queue routing plus SLA breach monitoring.
Cases with mig_risklevel = Critical or breached SLA move to supervisor-owned team/queue.
6.6 Configuration Components
Queues
Migration Triage Queue
Cloud Migration Queue
Hybrid Migration Queue
High Risk Queue
General Service Queue
Routing Rules
Use native routing rules / unified routing concepts where licensed; otherwise use queue assignment rules.

Conditions based on mig_migrationtype
Override for mig_risklevel
Fallback to General Service Queue
Forms
Account Main Form
Sections:

Core Client Details
Contact Information
Ownership
Migration Summary
Related Cases subgrid
Contact Main Form
Sections:

Identity
Contact Channels
Parent Account
Case Main Form
Use standard case form pattern with:

Summary
Details
Case Relationships
SLA
Related
This aligns with standard Customer Service case form structure.
Views
Account Views
Active Clients
Clients by Account Manager
Clients with Open Cases
Case Views
Active Migration Cases
High Risk Cases
Cases by Migration Type
My Assigned Cases
Queue Cases by Priority
Security Considerations
High-level only:

Use standard Customer Service roles as baseline.
Separate roles:
Customer Service Representative
Migration Team Lead
System Administrator
Restrict delete privileges on Accounts and Cases.
Use team ownership where shared workload is required.
Owner-based security is sufficient for current dataset size.
Business Process Flow
Deploy a single-entity Case BPF:

New
Triage
In Progress
Review
Resolved
Customer Service supports case-oriented process bars/BPF on forms.
6.7 Solution Packaging
Solution Name
Migration Service Management

Solution Unique Name
mig_MigrationServiceManagement

Publisher
Publisher display name: Migration Solutions
Publisher name: MigrationSolutions
Prefix: mig
Included Components
Standard table customizations:
Account
Contact
Case
Custom columns:
mig_sourceclientid
mig_legacyaccountmanagername
mig_contactrole
mig_sourcecaseid
mig_sourcecasenumber
mig_sourcecreateddate
mig_migrationtype
mig_estimatedhours
mig_risklevel
mig_legacysystemreference
mig_legacyownername
mig_dataloadbatch
mig_migrationnotes
Choice sets:
mig_migrationtype
mig_risklevel
mig_contactrole
Main forms and views
Business process flow
Queues
Routing rules
SLA and KPI items
Alternate keys
Duplicate detection rules
Model-driven app updates / app module inclusion
Naming Conventions
Tables
Standard tables keep standard schema.
No custom tables in current release.
Columns
Display name in business language
Schema name prefixed with mig_
Relationships
Standard relationships retained.
Any custom relationship names follow pattern:
mig_account_incident_<purpose>
Choice Sets
Display name singular and business readable
Schema name prefixed with mig_
Environment Strategy
Development: dedicated Dataverse dev environment
Test/UAT: isolated test environment with migrated sample/full UAT data
Production: live Customer Service environment
Avoid environment-specific GUID assumptions.
Keep same region across environments where possible; Microsoft migration guidance recommends planned environments and appropriate sizing.
Versioning
Start at 1.0.0.0
Increment minor version for schema/config changes
Increment patch version for safe configuration refinements
Idempotent Deployment Rules
To support MCP re-application safely:

Check for existing publisher by unique name before create.
Check for existing solution by unique name before create.
Check for existing custom columns by schema name before create/update.
Check for existing choice values before add.
Check for existing alternate keys before create.
Check for queue existence by name before create/update.
Upsert configuration records where possible.
Never recreate standard tables.
Migration loads must use alternate keys for upsert behavior, consistent with Microsoft guidance that ETL/upsert approaches improve repeatability and avoid duplicate creation.
6.8 Deviations from Standard
Custom Columns on Account
mig_sourceclientid
mig_legacyaccountmanagername
Justification: preserve immutable source identifiers and unresolved source ownership values without distorting standard fields.
Custom Columns on Contact
mig_contactrole
mig_sourceclientid
Justification: supports migration provenance and simple contact role classification.
Custom Columns on Case
mig_sourcecaseid
mig_sourcecasenumber
mig_sourcecreateddate
mig_migrationtype
mig_estimatedhours
mig_risklevel
mig_legacysystemreference
mig_legacyownername
mig_dataloadbatch
mig_migrationnotes
Justification: these source attributes do not have sufficient standard equivalents without overloading native semantics. Retaining them as custom fields is cleaner than repurposing unrelated standard fields.
No Custom Tables
Justification: current requirements are fully satisfied through Account, Contact, and Case extensions. This matches the native-first rule and Microsoft guidance to prefer standard/CDM-aligned entities.

6.9 Data Transformation Rules
Source-to-Target Mapping Rules
Clients.csv → Account
Source Field	Target Field	Rule
ClientID	accountnumber	Direct map; trim; uppercase preserved; unique alternate key.
ClientID	mig_sourceclientid	Direct map, exact source value preserved.
Client Name	name	Trim whitespace; required.
Contact Email	emailaddress1	Lowercase; validate email pattern; null if invalid.
Contact Phone	telephone1	Strip spaces/formatting; preserve leading + if present.
Industry	industrycode or mig_industrytext	Map to standard industry if controlled match exists; else load to custom text/choice placeholder.
Account Manager	ownerid	Resolve against Dataverse users by full name or email mapping table; if unresolved assign default team and store raw name in mig_legacyaccountmanagername.
Clients.csv → Contact
Create one contact per client when email or phone exists.

Source Field	Target Field	Rule
Client Name	fullname	Generate <Client Name> Primary Contact if no person name exists.
ClientID	mig_sourceclientid	Direct map.
Contact Email	emailaddress1	Direct validated map.
Contact Phone	telephone1	Normalized phone map.
ClientID	parentcustomerid	Resolve to Account via alternate key accountnumber.
Constant	mig_contactrole	Set to Primary Client Contact.
Then update Account:

primarycontactid = created contact
Cases.csv → Case
Source Field	Target Field	Rule
CaseID	mig_sourcecaseid	Treat as text despite source typing anomaly; trim and preserve exactly.
ClientID	customerid	Resolve to Account via alternate key accountnumber or mig_sourceclientid.
Title	title	Direct map; required.
Case Number	mig_sourcecasenumber	Preserve source reference exactly as text.
Priority	prioritycode	Map string to standard choice.
Status	statuscode / statecode	Map to controlled status reason and derived state.
Created On	mig_sourcecreateddate	Convert numeric YYYYMMDD to date.
Created On	createdon	Populate during migration only if import mechanism supports created-on override; otherwise leave system-set and preserve original in mig_sourcecreateddate.
Owner	ownerid	Resolve to Dataverse user/team; fallback default queue/team if unresolved.
Owner	mig_legacyownername	Preserve original source owner string when fallback used.
Migration Type	mig_migrationtype	Map to controlled choice; unknown to Unknown.
Estimated Hours	mig_estimatedhours	Decimal conversion; blank if invalid.
Risk Level	mig_risklevel	Map to controlled choice; unknown to Unknown.
Legacy System Reference	mig_legacysystemreference	Treat as text, not datetime.
Constant	caseorigincode	Set to Data Migration / Internal import equivalent.
Constant	mig_dataloadbatch	Set import batch identifier.
Specific Conversion Rules
Date Conversion
Created On source pattern YYYYMMDD:

Example: 20250301 → 2025-03-01
Reject impossible dates
Null invalid values and log to mig_migrationnotes
Text Cleanup
Trim leading/trailing spaces
Convert blank strings to null
Preserve original case for IDs and references
Numeric Conversion
Estimated Hours stored as Decimal(10,2)
Negative values rejected and logged
Status Mapping Default Matrix
Active/Open/New → New or In Progress depending on source wording
Pending/Waiting → Waiting for Customer or Waiting for Internal Dependency
Resolved/Closed Complete → Resolved
Cancelled/Canceled → Canceled
Unknown → New with migration note
Owner Resolution
Owner normalization requires a staff cross-reference table external to Dataverse deployment inputs:

Preferred match order:
Email
Azure AD UPN
Exact full name
Alias mapping table
If no match:
Assign default team owner
Preserve source raw value in custom text field
Duplicate Prevention
Account upsert key: accountnumber
Case upsert key: mig_sourcecaseid
Contact upsert key: composite logical rule via parentcustomerid + emailaddress1; if email blank, create one contact only when missing for account
Microsoft migration guidance recommends documented mappings, transformation rules, and ETL/upsert capability for repeatable migration and duplicate avoidance.

6.10 MCP-Ready Deployment Steps
Phase A: Foundation
Create publisher
Name: MigrationSolutions
Prefix: mig
Create primary solution
Unique name: mig_MigrationServiceManagement
Add existing standard components to solution
Account
Contact
Case
Queue-related components
SLA components
Phase B: Schema Configuration
Create custom choice sets:
mig_migrationtype
mig_risklevel
mig_contactrole
Create Account custom columns.
Create Contact custom columns.
Create Case custom columns.
Create alternate keys:
Account: accountnumber
Case: mig_sourcecaseid
Add duplicate detection rules.
Phase C: UX Configuration
Update Account main form.
Update Contact main form.
Update Case main form using standard tabs plus custom fields.
Create views listed above.
Ensure case related section and subgrids are present, consistent with standard Customer Service form usage.
Phase D: Service Management Configuration
Create queues:
Migration Triage Queue
Cloud Migration Queue
Hybrid Migration Queue
High Risk Queue
General Service Queue
Create routing rules / unified routing workstream conditions.
Create SLA:
First response KPI
Resolve KPI
Create Case business process flow.
Phase E: Migration Configuration
Prepare mapping specification workbook:
One tab per target table
Field mappings
transformation rules
owner resolution rules
This aligns to Microsoft migration planning guidance.
Prepare import sequence:
Users/Teams validation
Accounts
Contacts
Account primary contact updates
Cases
Prefer repeatable ETL/dataflow process over ad hoc manual imports for reusability, upserts, transformations, and delta handling.
Execute test migration in Dev/SIT.
Execute UAT migration with representative data.
Execute production cutover migration.
Phase F: Idempotent MCP Execution Hints
Every create action must first query by unique name/schema name.
If component exists, perform update rather than recreate.
Data loads must be upsert-based using alternate keys.
Queue and SLA configuration records must be matched by unique name.
Store load batch ID in mig_dataloadbatch for traceability and rerun safety.
6.11 Risks and Considerations
Over-Customization Risk
Creating custom tables for Client or Case would be unnecessary and would break native Customer Service advantages. This design avoids that by using Account and Case.

Data Quality Risk
Source typing anomalies for CaseID, Case Number, and Legacy System Reference
Created On is not a native date in source
Owner / Account Manager are denormalized strings
Mitigation: transformation rules, owner cross-reference, alternate keys, exception logging.

Deployment Risk
If import is done as raw flat-file loads without a repeatable mapping/transformation process, duplicates and lookup failures are likely. Microsoft guidance favors documented mapping and ETL/dataflow approaches for complex or repeatable migration.

Environment Risk
Migration and cleansing should not be mixed casually with other testing activities; dedicated migration/UAT cycles are recommended.

Governance Risk
Uncontrolled text values for Industry, Priority, Status, Migration Type, and Risk Level can degrade reporting.

Mitigation: controlled target choice sets with Unknown fallback, then post-migration data governance review.

PII Consideration
Email and phone are personal data. Only store what is required and secure via standard role-based access. General Microsoft guidance emphasizes minimizing unnecessary PII storage.

Final Authoritative Design Summary
This solution will be implemented using:

Account for clients
Contact for primary client contacts
Case for all migration/service requests
Queues, routing, and SLA for operational case management
Minimal custom fields only
No custom tables
It is:

native-first
Customer Service aligned
ALM-ready
idempotent for MCP deployment
migration-ready with explicit transformation and upsert rules
If needed next, I can convert this directly into a Phase 7 MCP deployment specification with ordered create/update operations and machine-friendly component definitions.