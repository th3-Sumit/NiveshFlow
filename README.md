# NiveshFlow

NiveshFlow is a personal finance management SaaS built with Next.js, MongoDB, Cloudinary, and email OTP flows. It is designed as a personal financial operating system where each user can manage accounts, transactions, debts, bills, savings goals, and profile data in an isolated workspace.

The app also includes a role-gated super admin area for platform management.

## Core Idea

The transaction ledger is the center of the application.

Every important movement of money should create a transaction. Other sections, such as dashboard summaries, debt progress, account balances, reports, and planning views, derive their numbers from that ledger instead of maintaining separate fake totals.

This is especially important for debt payments:

- Principal reduces liability.
- Interest and fees count as actual expenses.
- The full payment reduces the selected account balance.
- A debt payment creates both a `debtPayments` record and a `debt_payment` transaction.

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- shadcn-style local UI primitives
- React Hook Form for auth forms
- MongoDB for persistence
- Cloudinary for profile images
- Nodemailer for OTP email delivery
- Encrypted HTTP-only cookie sessions

## Environment Variables

Create `.env.local` from `.env.example` and fill in real values.

Required:

```env
MONGO_URI=
CLOUD_NAME=
CLOUD_API_KEY=
CLOUD_API_SECRET=
EMAIL_USER=
EMAIL_PASS=
AUTH_SECRET=
```

Super admin seeding:

```env
SUPER_ADMIN_PASSWORD=
SUPER_ADMIN_NAME=
SUPER_ADMIN_PHONE=
```

`AUTH_SECRET` is recommended for stable session encryption. If it is missing, the app falls back to other configured secrets, but a dedicated auth secret is cleaner.

## Install And Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Production checks:

```bash
npm run lint
npm run build
```

## Administrator Account

The super admin email is:

```text
`#############@@gmail.com
```

Any user signing up with this email is automatically assigned the `super_admin` role.

Set `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME`, and `SUPER_ADMIN_PHONE` privately in `.env.local` or your current shell, then seed the account:

```bash
npm run seed:admin
```

All three values are required. The script has no default identity, phone number, or password. Do not copy credentials into documentation, commit them, or run seeding as part of deployment. These variables are used only by the seeding script; the deployed application does not need them.

If the admin already exists, the script promotes the account to `super_admin`. It only resets the password when this is also set:

```powershell
$env:SUPER_ADMIN_RESET_PASSWORD="true"
```

## Application Flow

### Landing Page

Path:

```text
/
```

Purpose:

- Explains the product flow.
- Introduces authentication, SaaS isolation, and personal finance modules.
- Sends users to signup, password login, OTP login, or recovery.

### Signup

Path:

```text
/signup
```

Purpose:

- Creates a user workspace.
- Validates name, phone, email, password, and confirm password.
- Allows profile image upload during onboarding.
- Stores profile image in Cloudinary.
- Creates a session after signup.
- Assigns `super_admin` role if email matches `#############@gmail.com`.

### Login

Path:

```text
/login
```

Purpose:

- Password-based login.
- Validates credentials.
- Creates an encrypted session cookie.
- Redirects users to `/dashboard`.
- Redirects super admin to `/admin`.

### Login With OTP

Path:

```text
/login-otp
```

Purpose:

- Lets users log in without a password.
- User enters email or phone.
- Server creates a short-lived OTP.
- OTP is emailed to the user.
- User verifies OTP and receives a session.

### Forgot Password

Path:

```text
/forgot-password
```

Purpose:

- User requests password recovery using email or phone.
- Server sends OTP.
- User verifies OTP.
- App opens the new password screen.
- Password must satisfy all strength rules.

## Auth And Session Model

Sessions are encrypted and stored in an HTTP-only cookie named:

```text
finance_session
```

Session duration:

```text
7 days
```

Auth helpers live in:

```text
app/lib/session.ts
app/lib/password.ts
app/actions/auth.ts
```

## Main User Workspace

All authenticated user pages share the same app shell. The navbar stays fixed at the top, and page content scrolls below it.

### Dashboard

Path:

```text
/dashboard
```

Purpose:

- Gives users a financial overview.
- Shows total balance, monthly income, actual expenses, cash outflow, debt reduction, outstanding debt, and net worth.
- Shows recent transactions, upcoming bills, active debts, and savings goals.

How it works:

- Reads accounts, transactions, debts, bills, and goals from MongoDB.
- Calculates financial summary from ledger entries.
- Debt payment expense is calculated from interest + fees, not principal.

### Accounts

Path:

```text
/accounts
```

Purpose:

- Lets users create money sources.
- Examples: cash, checking, savings, credit card, digital wallet, investment, custom account.

Why it matters:

- Every transaction belongs to an account.
- Account balances are updated when income, expenses, transfers, and debt payments are recorded.

### Finding And Managing Records

Accounts, Transactions, Debt, and Planning use full-width lists. Select **Add account**, **Add transaction**, **Add debt**, **Record payment**, **Add bill**, or **Add savings goal** in the page header to open a dialog. Validation appears beside the affected field; failed saves leave the dialog and entered values open. Cancel or Escape closes a dialog when no save is running. Pencil and trash actions open edit and removal dialogs.

Enter a search term, choose type/status and sorting, and select **Apply**. **More filters** opens inclusive date ranges and, where relevant, account, debt, or billing frequency filters. Clear filters resets the list. Debt has separate **Debts** and **Payment history** views; Planning has **Bills & subscriptions** and **Savings goals** views. Switching views clears incompatible filters.

Use numbered pages, previous/next, or first/last controls to browse, and choose 10, 20, or 50 rows per page. Filter and page-size changes restart at page one. Filters, view, sorting, and pagination are retained in the URL for browser history and reloads. MongoDB searches all owned records, not only the displayed page or a fixed recent-record sample. Header totals cover **all matching records**, not just the current page; Transactions' Entry value is the sum of entry magnitudes, not net cash flow. Every read and write is scoped to the signed-in user's identity.

Run `npm run test:finance` to verify filtering, pagination, ownership boundaries, and dialog creation validation with isolated database/service fixtures.

### Transactions

Path:

```text
/transactions
```

Purpose:

- Records normal money movement.
- Supports income, expense, transfer, refund, bill payment, subscription payment, savings contribution, investment, and adjustment.

Important:

- Transfers move money between accounts and should not be treated as expenses.
- Debt payments should be recorded from the Debt section so principal, interest, and fees stay separated.

### Debt

Path:

```text
/debts
```

Purpose:

- Lets users create loans/debts.
- Supports personal loan, auto loan, home loan, student loan, credit card, family/friend debt, and custom debt.
- Tracks original principal, current principal, interest rate, minimum payment, and due dates.

Debt payment flow:

1. User selects debt.
2. User selects payment account.
3. User enters principal, interest, and fees.
4. App creates a `debt_payment` transaction.
5. App creates a `debtPayments` history record.
6. App reduces account balance by total payment.
7. App reduces debt principal by principal amount only.
8. Dashboard and reports derive updated values from the ledger.

### Planning

Path:

```text
/planning
```

Purpose:

- Manages bills and subscriptions.
- Manages savings goals.

Use cases:

- Electricity, internet, rent, insurance, Netflix, gym, phone bill.
- Emergency fund, vacation, education, house down payment, car, wedding, custom goals.

### Profile

Path:

```text
/profile
```

Purpose:

- Lets users update profile details.
- Supports name, phone, and a cropped profile image. Email is read-only and cannot be changed through the profile action.
- Profile image uploads to Cloudinary.

### Help Center

The floating bottom-right button opens the Help Center on every signed-in page.

1. Choose Issue, Query, or Feedback.
2. Choose Critical, Emergency, Just FYI, or Nothing Urgent. Priority is a triage label, not a response-time guarantee.
3. Add a subject (5-120 characters) and description (at least 10 words, up to 5,000 characters).
4. Optionally attach up to three PNG, JPG, PDF, or DOCX files, 5 MB each.
5. Send the request and keep its reference number. Open My requests for status and support replies.

For an email change, use Request an email change on Profile and include your requested new address in the description. A user cannot bypass this restriction by submitting an email field directly to the profile action.

Requests are stored in `supportRequests` with the authenticated owner's ID and contact details. Users can retrieve only their own latest 30 requests. Attachments use authenticated Cloudinary uploads, and a server-side download route checks ownership or the super admin role before streaming the file. Cloudinary identifiers and signed download URLs are never included in the user-facing request payload.

The admin inbox shows the latest 100 requests, with search and status/priority filters. Expand a request to see its submitter and attachments, reply, and update status. After verifying an email-change request, enter the new email and confirm it. The change runs in a MongoDB transaction, checks the unique email index, invalidates existing OTPs and reset tokens, and records the change on the resolved ticket. Changing the configured super admin identity is not supported by this action.

The upload limit is configured as 16 MB in Next.js to accommodate three 5 MB attachments plus multipart overhead. Uploads are validated for size, extension, MIME type, and file signature. This is not a malware scanning service.

Run `npm run test:support` for isolated authorization, request validation, profile email protection, attachment privacy, cleanup, and transactional email-change checks. These tests mock MongoDB and Cloudinary and do not write live data.

## Platform Administration

Path:

```text
/admin
```

Purpose:

- Platform management, not personal finance management.
- Super admin should manage app health, user accounts, configuration, support, security, and analytics.

Current sections:

- Users
- Subscriptions and payments
- Financial configuration
- Notifications
- Feature flags
- Support
- Security
- Reports and analytics

Important privacy rule:

Super admin should not have unrestricted access to users' private transaction descriptions, balances, debts, and financial history by default. If support access is added later, it should be permission-controlled and audited.

## MongoDB Collections

Authentication:

- `users`
- `otps`
- `passwordResetTokens`

Finance:

- `accounts`
- `transactions`
- `debts`
- `debtPayments`
- `bills`
- `budgets`
- `savingsGoals`
- `categories`

## Financial Model

### Accounts

Accounts represent money sources:

- Cash
- Bank account
- Wallet
- Credit card
- Investment account

### Transactions

Transactions are the ledger.

Supported types include:

- `income`
- `expense`
- `transfer`
- `debt_payment`
- `bill_payment`
- `subscription_payment`
- `refund`
- `savings_contribution`
- `investment`
- `adjustment`

### Debts

Debts store liability state:

- Original principal
- Current principal
- Interest rate
- Minimum payment
- Next payment date
- Status

### Debt Payments

Debt payment records store payment history:

- Total amount
- Principal amount
- Interest amount
- Fee amount
- Payment date
- Linked debt
- Linked account
- Linked transaction

## Important Calculation Rules

### Net Worth

```text
Net Worth = Account Balances + Savings Goals - Outstanding Debt
```

### Debt Payment

Example:

```text
Payment:   ₹10,000
Principal: ₹8,500
Interest:  ₹1,300
Fees:        ₹200
```

Result:

- Account balance decreases by ₹10,000.
- Debt principal decreases by ₹8,500.
- Actual expense increases by ₹1,500.
- Debt reduction is ₹8,500.

### Expense Reporting

Debt principal is not treated like groceries or rent. Principal reduces liability. Interest and fees are expenses.

## Project Structure

```text
app/
  actions/
    auth.ts
    finance.ts
  admin/
  accounts/
  dashboard/
  debts/
  planning/
  profile/
  transactions/
  components/
    app-shell.tsx
    auth/
    ui/
  lib/
    auth-state.ts
    cloudinary.ts
    constants.ts
    data.ts
    email.ts
    money.ts
    mongodb.ts
    password.ts
    session.ts
    validation.ts
scripts/
  seed-super-admin.mjs
```

## Common Development Commands

```bash
npm run dev
npm run lint
npm run build
npm run seed:admin
```

## Troubleshooting

### Netlify Deployment And Secret Scanning

Use `npm run build` as the build command and `.next` as the publish directory, with Netlify's automatically detected Next.js adapter. This app uses server actions and authenticated server rendering; do not deploy it as a static export.

Configure `MONGO_URI`, `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, and a dedicated `AUTH_SECRET` in Netlify's environment-variable settings, not in committed files or `next.config.ts.env`. Set `APP_URL` to the production HTTPS origin for invitations. If scopes are available, ensure application variables are available to Functions; this app's database module is also evaluated during builds, so `MONGO_URI` needs Builds access too. Variables in `netlify.toml` alone are not available to serverless functions. See [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/).

Remove `SUPER_ADMIN_NAME`, `SUPER_ADMIN_PHONE`, `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_RESET_PASSWORD` from the site's build/runtime environment after running the seed script separately. Never prefix private variables with `NEXT_PUBLIC_`. `CLOUDINARY_URL` is not read by this app; configure the three `CLOUD_*` variables instead.

Next.js 16.3 enables persistent Turbopack build caching by default. Its binary compiler cache can retain environment values even when browser bundles do not contain them. `next.config.ts` disables that build cache when Netlify's `NETLIFY=true` flag is present. The npm `postbuild` hook removes only restored `.next/cache/turbopack` and `.netlify/.next/cache/turbopack` directories on Netlify. Local builds/development, deployed bundles, and route/runtime caches are untouched. Netlify artifacts are also ignored by Git.

Secret scanning remains enabled: there are no path/key exclusions. After deploying this fix, clear Netlify's build cache and retry the deploy once to discard artifacts from older builds. Review the new scan results. A match in source, `.next/static`, server bundles, or function artifacts must be investigated and removed, not ignored. [Netlify secret scanning](https://docs.netlify.com/build/environment-variables/secrets-controller/) checks repository code and generated files before deployment; a failure alone does not prove a credential reached a public client.

If a real password or provider key was ever committed, logged, or published, rotate it at its provider and update the private environment settings. Removing it from the current tree does not erase Git history. Run `npm run test:deployment` to check the cache cleanup and seeding safeguards without connecting to live services.

### MongoDB TLS Or Server Selection Error

If signup or seeding fails with MongoDB TLS/server selection errors:

- Check MongoDB Atlas Network Access.
- Allow your current IP address.
- Confirm username/password are correct.
- URL-encode special characters in the MongoDB password.
- Use Node.js 20 or 22 LTS.

### OTP Email Not Sending

Check:

- `EMAIL_USER`
- `EMAIL_PASS`
- Provider app password settings
- Spam folder

### Cloudinary Upload Not Working

Check:

- `CLOUD_NAME`
- `CLOUD_API_KEY`
- `CLOUD_API_SECRET`

## Admin Workspace And Account Lifecycle

- The super admin lands on `/admin` with Dashboard, Users, Leads, Tickets, Profile, Operations, and Docs tabs. Normal users retain their personal finance navigation.
- Dashboard reports aggregate user counts and daily growth (UTC, 7/30/90 days). Active means allowed to sign in; Inactive means disabled; Invited means a valid pending invitation; Expired means a pending invitation past its deadline. Recent logins are tracked separately. No private finance balances are sent to the dashboard.
- Users lists every account through search, status filters, and 20-row pagination. Admin can edit a normal user's name/phone and disable or enable access. The configured super admin identity is protected. Email changes remain the reviewed Tickets workflow.
- Invite user reserves a unique email/phone and emails a cryptographically random, single-use link. Only its SHA-256 hash is stored. The server enforces a strict 72-hour expiry during activation; no scheduled expiry task is required. Reinvite replaces the old token and grants a new 72-hour window. Failed SMTP delivery is shown in Users and retried with Reinvite.
- The recipient opens `/accept-invitation`, sets a valid password, and becomes Active atomically. Expired, disabled, replaced, or consumed invitations cannot activate. A disabled user cannot use password login, OTP, or recovery. Access changes increment the session version, so re-enabling never resurrects old sessions.
- Leads stores prospect contact details, source, notes, and stage. Invite from a lead links it to a user; activation moves the lead to Converted. Removing a lead does not delete the user.
- Tickets holds the support inbox. Profile manages the admin's own information. Operations retries failed post-deletion notification and media-cleanup jobs.

### Invitation Configuration

Set `APP_URL` to the canonical public application origin, for example `https://finance.example.com`. Production invitations require HTTPS. `NEXT_PUBLIC_APP_URL` is a fallback; development defaults to `http://localhost:3000`. SMTP uses the existing `EMAIL_USER` and `EMAIL_PASS` configuration. Never expose SMTP, MongoDB, Cloudinary, session, invitation, or reset secrets in public environment variables.

### Editing And Removing Finance Records

Each account, ledger entry, debt, bill, and savings goal has edit and remove controls. Every mutation checks the signed-in owner on the server.

- Opening-balance edits adjust current balance by the difference.
- Transaction edits undo the original movement and apply the replacement in one MongoDB transaction. Removal reverses its balance effects before removing it. Transfer source/destination and debt-payment principal changes are included atomically.
- Debt-payment edits keep payment history synchronized with the ledger. A debt with linked payments cannot have its principal overwritten directly.
- Accounts, debts, bills, or goals with dependent transactions/payments cannot be removed until dependencies are removed or unlinked.
- Bill status and goal progress are planning values, not automatic bank transactions.

MongoDB must support transactions (Atlas or another replica set). Do not use a standalone MongoDB server for these workflows.

### Permanent Account Deletion

Profile includes a Danger zone for normal users. Opening it creates a random, owner-bound confirmation phrase valid for 10 minutes. Deletion requires the exact phrase and current password; incorrect password attempts are limited per challenge. The super admin cannot self-delete.

The server transaction consumes the challenge and removes the user, accounts, transactions, debts, payments, bills, goals, budgets, owned categories, OTPs/reset tokens, tickets, linked leads, and deletion challenges. The session is cleared, and the user returns to the landing page. Optional reason/feedback is retained without a user ID, name, or email and appears on the admin dashboard. Users are advised not to put personal information in feedback.

Deletion email and Cloudinary cleanup jobs are created in the same transaction. The server attempts them immediately. Failed jobs remain durable and are retried from Admin > Operations. The email job temporarily retains the delivery recipient and message until successful delivery; the job is then removed. Cloudinary asset identifiers remain only as needed for cleanup. A provider outage does not restore a deleted account. Email delivery is at-least-once, so a retry after an uncertain provider/DB result can produce a duplicate confirmation. Provider backups and MongoDB backups follow separately configured retention policies.

### Verification

```bash
npm run test:support
npm run test:lifecycle
npm run lint
npm run build
```

Lifecycle tests use isolated service doubles and actual action modules. They do not send email or delete live accounts.

## Recommended Next Features

- Budget module with category thresholds.
- Reports and analytics page.
- Reversal/audit flow for mistaken transactions and debt payments.
- Category management UI.
- CSV import.
- Financial calendar.
- Admin audit logs.
- Notification settings.
