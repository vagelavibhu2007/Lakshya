# 🎯 Lakshya 2.0 — Members & Operations Portal

> **Internal operations, team coordination, and centralized email-dispatch infrastructure for the Lakshya 2.0 technical fest.**

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![Resend](https://img.shields.io/badge/Resend-Email_API-black.svg)](https://resend.com/)
[![Nodemailer](https://img.shields.io/badge/Nodemailer-SMTP-blue.svg)](https://nodemailer.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248.svg?logo=mongodb&logoColor=white)](https://mongoosejs.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

## 📌 Overview

**Lakshya 2.0 Members Portal** is the centralized operations platform designed to organize and streamline workflows for hundreds of student volunteers, team leaders, faculty coordinators, and campus ambassadors during **Lakshya 2.0**.

Beyond task allocation and volunteer tracking, a vital component of this platform is its **robust, rate-limited email delivery and notification infrastructure**, ensuring dependable event-wide communications, automated onboarding, and targeted committee broadcasts without triggering spam filters or provider rate limits.

---

## ✉️ Email-Sending Architecture & Delivery Pipeline

The communication backbone of Lakshya 2.0 was engineered to solve high-volume, multi-committee notification challenges, featuring rate-limited batching, dynamic recipient filtering, multi-transport support, and strict role authorization.


### 1. Dual-Transport Engine & Fallback Mechanism
- **Resend API Integration:** Primary high-deliverability transport configured with a dedicated sending domain (`noreply@mail.lakshya-mngt.online`) utilizing `@resend/node`.
- **Nodemailer SMTP Fallback:** Secondary transport connecting to custom institutional SMTP relays when external API gateways are disabled or unreachable.
- **Dynamic Switcher:** Centralized utility dynamically evaluates environment settings (`EMAIL_SERVICE='resend'` vs `'nodemailer'`) without modifying calling route controllers.

### 2. Rate-Limiting & Fault-Tolerant Retry Loop
- **Provider Concurrency Adherence:** Resend enforces a strict limit of 2 requests/second. To stay safely under this threshold, `sendBatchEmails()` implements an asynchronous pacing delay (`await sleep(700 + Math.random() * 200)`) between dispatches, guaranteeing a stable throughput of ~1.2 to 1.5 emails/second.
- **Exponential Backoff for HTTP 429:** If an upstream rate limit is encountered (`429 rate_limit_exceeded`), the worker initiates an automated retry routine with incremental backoff (`2000ms * (retryCount + 1)`) for up to 3 successive attempts per recipient.
- **Plaintext Generation:** Automatically parses and strips HTML markup into clean plaintext fallback bodies, maximizing inbox placement and anti-spam scoring across mail clients.

### 3. Admin Centralized Email Console
- **Dynamic Audience Querying:** Target recipients dynamically by selecting any combination of:
  - **Roles:** Admin, Team Leader, Member, or Campus Ambassador.
  - **Committees / Teams:** Filter by primary and secondary team memberships (Tech, PR, Marketing, etc.).
  - **Direct Specific Addresses:** Ad-hoc manual recipient inputs.
- **Real-Time Target Preview:** `GET /api/emails/preview-targets` evaluates the MongoDB query in real time, displaying deduplicated recipient counts and matching email addresses before the job is launched.
- **Built-in Responsive Email Templates:**
  - 👔 **Formal Notification:** Institutional memos and official circulars (Indigo theme).
  - ✅ **Success & Announcements:** General celebration and milestone bulletins (Emerald theme).
  - 🏆 **Congratulations & Commendations:** Special awards and performance recognition (Amber theme).
  - ⚠️ **Important Warning:** Time-sensitive deadlines and critical alerts (Rose theme).
  - 📝 **Custom Raw HTML:** Complete authoring freedom with live in-browser preview.
- **Non-Blocking Background Dispatch:** Massive recipient lists are offloaded to background execution immediately after validation, preventing client HTTP request timeouts. Detailed audit metrics (`successCount`, `failureCount`, and error breakdowns) are written to persistent logs.

---

## 🔍 Email Trigger Governance & Analysis Report

As documented in [`email_analysis_report.md`](email_analysis_report.md), an architectural audit was conducted across the codebase to identify every email dispatch surface, centralize control, and prevent accidental spam or automated delivery leaks:

| Location / File | Function / Trigger | Original Purpose | Governance Decision & Status |
|---|---|---|---|
| `routes/emails.js` | `sendBatchEmails()` via Admin console | Manual bulk communications to targeted committees | **KEPT (Primary):** Strict Admin-only manual trigger protected with `requireRole('admin')`. |
| `routes/adminUsers.js` | `sendBulkUserCredentialsEmail()` | Dispatches temporary passwords and access links on member import | **KEPT:** Controlled by Admin toggle during batch CSV/Excel onboarding. |
| `routes/announcements.js`| `sendBatchEmails()` on announcement creation | Notified committee members when new announcements were published | **RESTRICTED:** Removed automated email trigger from Team Leaders; restricted mass mailing strictly to Admin. |
| `cron/weeklyLeaderboard.js`| `sendBatchEmails()` via scheduled cron | Distributed automated weekly score digests every Monday | **RESTRICTED / CENTRALIZED:** Background cron decoupled from unmoderated automated email blasts. |
| `routes/enhancedAuth.js` | `sendPasswordResetEmail()` & `sendEmailVerificationEmail()` | Public self-service password reset & verification | **AUDITED:** Standardized and secured behind centralized email templates and logging. |

### Architectural Improvements Implemented:
1. **Centralized Service Isolation:** Direct imports of mailing utilities were isolated behind administrative route fences, eliminating rogue or unmoderated dispatches.
2. **Access Control Enforcement:** Standardized middleware ensures that bulk mailing endpoints unconditionally enforce `verifyToken` and `requireRole('admin')`.
3. **Execution Observability:** Replaced unhandled promise calls with structured summaries logging per-recipient delivery statuses and HTTP responses.

---

## 🏢 Platform Features & Operations

While the communication engine drives outreach, the platform encompasses full event management capabilities for Lakshya 2.0:

### 1. Committee Structure & Multi-Team Switching
- Supports the 7 functional pillars of Lakshya 2.0: **Tech**, **PR & Publicity**, **Marketing**, **Sponsorship**, **Graphics & Visuals**, **Production & Logistics**, and **Content & Decoration**.
- Team leaders and organizers with cross-functional roles can switch active team contexts on the fly without logging out.

### 2. Task Allocation & Multi-Format Proof Verification
- Team leaders assign tasks with deadlines, priority tags, and base points.
- Members execute tasks and upload proof via:
  - 🔗 Direct URLs (Git PRs, Figma boards, live web pages).
  - 📄 Cloudinary documents (native PDF previews, spreadsheets, images).
  - 📝 Rich descriptive text summaries.
- Team leads verify submissions, request revisions, or award credits.

### 3. Gamification & Points Ledger
- Every credit or deduction is committed to an immutable double-entry `PointsLedger`.
- Real-time aggregation pipelines calculate individual rankings and inter-team leaderboards.

### 4. Attendance & Reporting
- Daily and session-specific attendance logging across all active committee members.
- Specialized audit reports for faculty coordinators to accredit student volunteer participation.

### 5. Campus Ambassador (CA) Program
- Unique referral link attribution tracking student registrations from external colleges.
- Dedicated ambassador performance metrics and referral leaderboards.

### 6. Batch Member Onboarding
- Rapid bulk onboarding of volunteers and coordinators via CSV/Excel spreadsheets with automated team mapping and credential generation.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Email Infrastructure** | Resend API (`@resend/node`), Nodemailer (SMTP transport), HTML responsive templates |
| **Backend API** | Node.js, Express.js, Mongoose ODM, Winston Logger, Morgan |
| **Database** | MongoDB (Aggregation pipelines, Points ledger, User/Task collections) |
| **Authentication & Security** | JWT Access Tokens, HTTP-only Cookie Refresh Rotation, Bcrypt hashing, RBAC |
| **File Storage** | Cloudinary API, Multer, Multer Storage Cloudinary |
| **Frontend Client** | React 18, Vite 5, Tailwind CSS, TanStack React Query v5, React Router v6, React Hot Toast |

---

## 📄 License

Developed and maintained exclusively for the internal operations and team management of **Lakshya 2.0**. All rights reserved.