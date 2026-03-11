# EMAIL TRIGGER ANALYSIS REPORT

## 1. Email Triggers Identified

1. **File:** [/server/src/routes/enhancedAuth.js](file:///f:/240280116141/TechFest/server/src/routes/enhancedAuth.js)
   **Function:** `forgotPassword()` -> [sendPasswordResetEmail()](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#72-140)
   **Module:** Enhanced Auth (Authentication)
   **Trigger Condition:** When a user requests a password reset
   **Purpose of the email:** Send password reset link with a token
   **Recommendation:** REMOVE (Should be centralized or requested via Admin)

2. **File:** [/server/src/routes/enhancedAuth.js](file:///f:/240280116141/TechFest/server/src/routes/enhancedAuth.js)
   **Function:** `resend-verification` endpoint -> [sendEmailVerificationEmail()](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#141-209)
   **Module:** Enhanced Auth (Authentication)
   **Trigger Condition:** When a user requests to resend their verification email
   **Purpose of the email:** Send email verification link
   **Recommendation:** REMOVE (Should be centralized or requested via Admin)

3. **File:** [/server/src/routes/adminUsers.js](file:///f:/240280116141/TechFest/server/src/routes/adminUsers.js)
   **Function:** Bulk upload endpoint -> [sendBulkUserCredentialsEmail()](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#210-289)
   **Module:** Admin Users
   **Trigger Condition:** When an Admin creates users in bulk and [sendEmail](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#29-71) flag is true
   **Purpose of the email:** Send temporary passwords and welcome information
   **Recommendation:** KEEP (This is an Admin-controlled manual trigger)

4. **File:** [/server/src/routes/announcements.js](file:///f:/240280116141/TechFest/server/src/routes/announcements.js)
   **Function:** Create announcement endpoint -> `sendBatchEmails()`
   **Module:** Announcements
   **Trigger Condition:** When an announcement is created with [sendEmail](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#29-71) set to true (Can be triggered by `admin` or `teamleader`)
   **Purpose of the email:** Notify users about a new announcement
   **Recommendation:** REMOVE / RESTRICT (Only Admin should be able to send emails; Team Leaders should not have this capability)

5. **File:** [/server/src/cron/weeklyLeaderboard.js](file:///f:/240280116141/TechFest/server/src/cron/weeklyLeaderboard.js)
   **Function:** [startWeeklyLeaderboardCron()](file:///f:/240280116141/TechFest/server/src/cron/weeklyLeaderboard.js#54-118) -> `sendBatchEmails()`
   **Module:** Background Jobs / Cron
   **Trigger Condition:** Automatic cron job running every Monday at 9:00 AM
   **Purpose of the email:** Send a weekly leaderboard digest to users
   **Recommendation:** REMOVE (Automatic triggers should be disabled)

6. **File:** [/server/src/routes/emails.js](file:///f:/240280116141/TechFest/server/src/routes/emails.js)
   **Function:** `send-bulk` and `test-batch` endpoints -> `sendBatchEmails()`
   **Module:** Emails Admin (Admin Panel)
   **Trigger Condition:** Admin manually triggering bulk or test emails
   **Purpose of the email:** Send custom manual emails to targeted groups
   **Recommendation:** KEEP (Matches the requirement that only Admin sends emails)

---

## 2. Configuration & Utilities

### All email utility files
* [/server/src/utils/mailer.js](file:///f:/240280116141/TechFest/server/src/utils/mailer.js) - Basic email sending utility wrapper for Nodemailer.
* [/server/src/utils/resendMailer.js](file:///f:/240280116141/TechFest/server/src/utils/resendMailer.js) - Utility for sending emails using Resend (includes retry logic and batching).
* [/server/src/utils/emailService.js](file:///f:/240280116141/TechFest/server/src/utils/emailService.js) - High-level email service containing HTML templates for various specific emails (Reset, Verification, Welcome, Invitation) and switching between `nodemailer` and `resend`.

### All SMTP configuration files
* SMTP configuration is dynamically loaded inside [/server/src/utils/emailService.js](file:///f:/240280116141/TechFest/server/src/utils/emailService.js) (lines 11-22) and [/server/src/utils/mailer.js](file:///f:/240280116141/TechFest/server/src/utils/mailer.js).
* Background setup handles Resend API configuration as well.

### Environment variables related to email
* `EMAIL_SERVICE` (Options: 'resend', 'nodemailer')
* `SMTP_HOST`
* `SMTP_PORT`
* `SMTP_SECURE`
* `SMTP_USER`
* `SMTP_PASS`
* `RESEND_API_KEY`
* `FROM_EMAIL`
* `RESEND_FROM_EMAIL`

### Libraries used for sending emails
* `nodemailer` (SMTP transport)
* `resend` (Resend API client)

---

## 3. Refactoring Suggestions

To ensure only the Admin module can send emails and no other modules trigger emails automatically:

1. **Centralize Email Logic:**
   Create a single, strict internal service (e.g., `AdminEmailManager`) that only the `/admin` routes can import and invoke. Remove all direct imports of [emailService.js](file:///f:/240280116141/TechFest/server/src/utils/emailService.js) and [resendMailer.js](file:///f:/240280116141/TechFest/server/src/utils/resendMailer.js) from other modules like Auth, Announcements, and Cron jobs.

2. **Remove Automatic Triggers:**
   - **Auth:** Remove [sendPasswordResetEmail](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#72-140) and [sendEmailVerificationEmail](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#141-209) from [enhancedAuth.js](file:///f:/240280116141/TechFest/server/src/routes/enhancedAuth.js). (If these flows are strictly required for security, consider routing them through a central logging admin service or disabling them if the app dictates strict admin-only communication).
   - **Cron:** Disable the cron job in [weeklyLeaderboard.js](file:///f:/240280116141/TechFest/server/src/cron/weeklyLeaderboard.js) by commenting out or removing the `cron.schedule` block, or extract the email sending part so it only calculates the leaderboard.
   - **Announcements:** Remove the [sendEmail](file:///f:/240280116141/TechFest/server/src/utils/emailService.js#29-71) boolean check in [announcements.js](file:///f:/240280116141/TechFest/server/src/routes/announcements.js) for `teamleader` roles. Ensure only the Admin role can hit the mailing endpoints.

3. **Restrict the Utilities:**
   Refactor [utils/emailService.js](file:///f:/240280116141/TechFest/server/src/utils/emailService.js) to assert `req.user.role === 'admin'` if passing the request context, or move the email sending utility physically inside a `/server/src/admin/` folder so it's structurally discouraged to import into public routes.

4. **API Gateway / Middleware Enforcement:**
   Add a middleware to all email-triggering endpoints that strictly checks `requireRole('admin')`. Since endpoints in [routes/emails.js](file:///f:/240280116141/TechFest/server/src/routes/emails.js) already have this, simply funnel all email requests through those specific endpoints/controllers.
