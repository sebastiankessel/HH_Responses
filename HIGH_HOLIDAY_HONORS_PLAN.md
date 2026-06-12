# High Holiday Honors RSVP Site Plan

## Goal

Build a Sites-hosted web app for Congregation Ner Tamid of South Bay to manage High Holiday honors assignments, invitation emails, and member RSVP responses.

The app should let an admin configure a Jewish year, define services and honors, upload assigned members, manually create and edit all setup data, send RSVP invitations, and review responses. Members do not authenticate. Each RSVP link should identify one specific honor assignment through an opaque token.

## Platform

- Use the Sites `vinext` starter.
- Use D1 for durable structured data.
- Do not add full authentication.
- Protect admin screens with a single hardcoded password, ideally provided through an environment variable.
- Use a transactional email provider such as Resend, Postmark, SendGrid, or another selected provider.

## Branding and Visual Direction

- Brand the site for Congregation Ner Tamid of South Bay.
- Use visual cues from `www.nertamid.com`, including the synagogue name, South Bay / Rancho Palos Verdes context, and the phrase "Jewish Spirit - Modern Experience" where appropriate.
- Use a warm, respectful, inviting design suitable for High Holiday communication.
- Keep admin screens clear and task-focused.
- Keep member RSVP screens simple, gracious, and easy to complete on mobile.

## Core Data Model

### `high_holiday_years`

- `id`
- `jewish_year`
- `label`
- `is_active`
- `created_at`
- `updated_at`

### `services`

- `id`
- `year_id`
- `name`
- `service_date`
- `service_time`
- `sort_order`

### `honors`

- `id`
- `year_id`
- `service_id`
- `honor_type`
- `prayer_name`
- `page_number`
- `estimated_honor_time`
- `sort_order`

### `members`

- `id`
- `name`
- `email`
- `phone`
- `external_member_id`
- `created_at`
- `updated_at`

### `assignments`

Each assignment represents one member assigned to one honor. This is the unit of RSVP and email.

- `id`
- `year_id`
- `honor_id`
- `member_id`
- `rsvp_token`
- `email_status`
- `email_sent_at`
- `response_status`: `pending`, `accepted`, or `declined`
- `created_at`
- `updated_at`

### `rsvp_responses`

- `id`
- `assignment_id`
- `status`: `accepted` or `declined`
- `wants_reschedule`: `yes`, `no`, `unsure`, or `null`
- `notes`
- `submitted_at`

### `rsvp_response_services`

Used when a declined member optionally indicates services they expect to attend.

- `id`
- `response_id`
- `service_id`

### `email_events`

- `id`
- `assignment_id`
- `recipient_email`
- `provider_message_id`
- `status`
- `error_message`
- `sent_at`

## Admin Experience

### Password Gate

- Admin routes require entering the admin password.
- Store successful access in a secure session cookie.
- Do not expose admin functionality through client-only checks.

### Jewish Year Defaulting

Every admin screen with a Jewish year selector should default to the next immediate Jewish year.

Rule:

- Determine the current Jewish year.
- Default the admin year selection to current Jewish year + 1.

For example, if the current Jewish year is `A`, default the admin screens to `A+1`.

The current Jewish year can be obtained from Hebcal, which provides web APIs without requiring registration or API keys. Use Hebcal's date-converter or related REST API to derive the current Jewish year, then cache or gracefully fall back if the API is unavailable.

### Dashboard

Show a summary for the selected Jewish year:

- Total honors.
- Total assignments.
- Emails sent.
- Pending responses.
- Accepted responses.
- Declined responses.
- Assignments without email addresses.

Include filters by service, honor, response status, and email status.

### Year and Setup Screen

Allow the admin to:

- Create or select a Jewish year.
- Add/edit services.
- Add/edit honors.
- Upload an honors CSV.
- Manage services and honors both manually and through upload.

### Assignment Upload Screen

Allow the admin to upload updated assignment/member lists.

The import preview should classify rows as:

- New assignments.
- Existing assignments.
- Rows with changed member details.
- Rows with missing or invalid email.
- Rows with unknown honors or services.
- Rows that need correction before import.

Only valid rows should be imported.

### Email Sending Screen

Important rule: a member receives one email per honor.

If the same member has multiple honors, each assignment gets its own email and unique RSVP link.

The admin can:

- Manually create assignments.
- Edit assignments, members, services, honors, and year setup data.
- Send invitations to newly added assignments that have email addresses and have not already been emailed.
- Re-send an individual assignment invitation if needed.
- See email status and failures.
- Copy an RSVP link manually.

### Response Review Screen

For each assignment, show:

- Member.
- Honor.
- Service.
- Email status.
- RSVP status.
- Submitted date.
- Notes.

For declined responses, also show:

- Whether the member wants the office to try to reschedule the honor if possible.
- Which services the member expects to attend, if provided.
- Any notes.

Flag declined responses as possible alternative candidates when:

- The response is declined.
- `wants_reschedule` is `yes` or `unsure`.
- At least one attended service is selected.

### Export

Provide CSV export for:

- Full assignment list.
- Pending responses.
- Accepted honors.
- Declined honors with reschedule/attendance details.

## Member RSVP Experience

### RSVP Link

Use a route like:

`/rsvp/:token`

The token must be long, random, and opaque. It resolves to exactly one assignment.

### RSVP Page

Show:

- Congregation Ner Tamid branding.
- Member name.
- Jewish year / High Holiday context.
- Assigned honor.
- Service name and date/time.
- Clear buttons to accept or decline.

### Accept Flow

If the member accepts:

- Confirm that they are accepting the assigned honor.
- Allow optional notes.
- Save the response.
- Show a thank-you confirmation.

### Decline Flow

Declining means:

"I do not wish to, or cannot, perform this assigned honor."

After the member chooses decline, ask:

- "Would you like the office to try to reschedule this honor if possible?"
  - Yes
  - No
  - Not sure / please contact me
- "Which High Holiday services do you plan to attend?"
  - Optional checkbox list of available services.
  - Explain briefly that this helps the office identify possible alternatives.
- Notes:
  - Optional free text for availability, preferences, constraints, or anything the office should know.

Then show a confirmation page.

### Invalid or Completed Links

If a token is invalid, show a polite message directing the member to contact
Sebastian Kessel at `ritualvp@nertamid.com`.

If an RSVP was already submitted, show the current response and direct the member
to contact Sebastian Kessel at `ritualvp@nertamid.com` if something changes.
Submitted RSVP responses cannot be edited by members.

## CSV Format

### Honors CSV

Recommended columns:

- `year`
- `service_name`
- `honor_type`
- `prayer_name`
- `page_number`
- `estimated_honor_time`

`prayer_name` may be empty.

### Assignments CSV

Recommended columns:

- `member_name`
- `email`
- `year`
- `service_name`
- `honor_type`
- `prayer_name`
- `page_number`
- `phone`
- `external_member_id`

Matching should be deterministic. Assignment imports should match honors by year, service, honor type, prayer name, and page number.

## Email Template

Each assignment email should include:

- Personal greeting.
- Assigned honor.
- Service/date/time.
- RSVP link.
- Brief explanation that the link is unique to this honor.
- Congregation Ner Tamid signature.

Because a member receives one email per honor, the subject should include the honor type or service name to reduce confusion.

Example subject:

`Congregation Ner Tamid High Holiday Honor: [Honor Type]`

## Security and Reliability

- Admin password validation must happen server-side.
- RSVP tokens must not be guessable.
- Avoid exposing assignment ids in public URLs.
- Email sending should be idempotent enough to avoid accidental duplicate batch sends.
- Track email send attempts and failures.
- Do not email assignments without email addresses.
- Do not automatically email existing assignments after a revised upload; email only newly added eligible assignments unless the admin explicitly re-sends.
- If Hebcal is unavailable when determining the default admin year, fall back to the most recently used configured year or allow the admin to choose manually.

## Implementation Phases

1. DONE - Scaffold the Sites app and configure D1.
2. DONE - Build schema, migrations, and database helper functions.
3. DONE - Build branded layout and admin password gate.
4. DONE - Build year, service, and honor setup screens.
5. DONE - Build CSV upload, parsing, validation, and import preview.
6. DONE - Build assignment import and deduplication.
7. DONE - Build member RSVP token pages and response persistence.
8. DONE - Add transactional email integration and send tracking.
9. DONE - Add manual admin create/edit flows for all setup data and assignments.
10. DONE - Build admin response dashboard and CSV exports.
11. DONE - Polish visual design, mobile responsiveness, and empty/error states.
12. DONE - Run local build validation.
13. DONE - Deploy with Sites when ready.

## Open Decisions

- Which transactional email provider to use.
- Exact CSV files the admin expects to upload.
