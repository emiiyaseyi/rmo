# Email Templates

This directory contains branded React Email templates for DSN RMO notifications.

## Setup

The project uses [Resend](https://resend.com) for email delivery and [React Email](https://react.email) for templating.

### Environment Variables

Make sure you have set the following in your `.env` file:

```env
RESEND_API_KEY=your_resend_api_key
SMTP_FROM="DSN RMO Notification"
```

## Available Templates

### 1. BaseEmail
Base layout component used by all other templates. Includes:
- DSN RMO branded header (green #076C04)
- Consistent footer
- Responsive design

### 2. NotificationEmail
Generic notification template for any type of notification.

**Usage:**
```typescript
import { sendNotificationEmail } from '@/lib/email'

await sendNotificationEmail(
  'user@example.com',
  'Notification Title',
  'Your notification message here',
  'https://app.com/details', // optional action URL
  'View Details' // optional action text
)
```

### 3. TimesheetApprovalEmail
For timesheet approval/rejection notifications.

**Usage:**
```typescript
import { sendTimesheetApprovalEmail } from '@/lib/email'

await sendTimesheetApprovalEmail(
  'user@example.com',
  'John Doe',
  '2026-03-24',
  'approved', // or 'rejected'
  'Great work this week!', // optional feedback
  'https://app.com/timesheet' // optional action URL
)
```

### 4. TimesheetReminderEmail
For timesheet submission reminders.

**Usage:**
```typescript
import { sendTimesheetReminderEmail } from '@/lib/email'

await sendTimesheetReminderEmail(
  'user@example.com',
  'John Doe',
  '2026-03-24',
  'Tuesday, March 25, 4:00 PM',
  'https://app.com/timesheet'
)
```

### 5. LeaveApprovalEmail
For leave request approval/rejection notifications.

**Usage:**
```typescript
import { sendLeaveApprovalEmail } from '@/lib/email'

await sendLeaveApprovalEmail(
  'user@example.com',
  'John Doe',
  'Annual Leave',
  'March 24, 2026',
  'March 28, 2026',
  'approved', // or 'rejected'
  'Enjoy your vacation!', // optional comment
  'https://app.com/leave'
)
```

### 6. PasswordResetEmail
For password reset requests.

**Usage:**
```typescript
import { sendPasswordResetEmail } from '@/lib/email'

await sendPasswordResetEmail(
  'user@example.com',
  'John Doe',
  'https://app.com/reset?token=xyz',
  '1 hour' // optional expiry time
)
```

### 7. WelcomeEmail
For new user onboarding.

**Usage:**
```typescript
import { sendWelcomeEmail } from '@/lib/email'

await sendWelcomeEmail(
  'user@example.com',
  'John Doe',
  'user@example.com',
  'https://app.com/login'
)
```

## API Routes

### POST /api/email
Legacy endpoint that accepts custom HTML (backward compatible with existing code).

**Request:**
```json
{
  "to": "user@example.com",
  "subject": "Email subject",
  "html": "<html>...</html>",
  "text": "Plain text version"
}
```

### POST /api/email/send-template
New endpoint for template-based emails.

**Request:**
```json
{
  "type": "notification",
  "to": "user@example.com",
  "title": "Notification Title",
  "message": "Your message",
  "actionUrl": "https://app.com/action",
  "actionText": "View Details"
}
```

**Available types:**
- `notification`
- `timesheet-approval`
- `timesheet-reminder`
- `leave-approval`
- `password-reset`
- `welcome`

## Helper Function

The existing `sendEmailNotification` helper in `src/lib/utils.ts` has been updated to automatically use the new React Email templates:

```typescript
import { sendEmailNotification } from '@/lib/utils'

// This now uses the branded React Email template automatically
await sendEmailNotification(
  'user@example.com',
  'Title',
  'Message',
  '/optional-link'
)
```

## Testing Emails Locally

To preview email templates during development:

1. Add a dev script to `package.json`:
   ```json
   "email:dev": "email dev"
   ```

2. Run the preview server:
   ```bash
   npm run email:dev
   ```

3. Open http://localhost:3000 to preview all templates

## Customization

### Brand Colors
The templates use DSN RMO brand colors defined in `src/app/globals.css`:
- Primary Green: `#076C04`
- Hover Green: `#065903`
- Light Green: `#F0FDF4`

### Fonts
Templates use the Poppins font family to match the main application.

## Notes

- All emails are fully responsive and work across email clients
- Templates are compiled to HTML at runtime using React Email's `render` function
- Resend provides excellent deliverability and analytics
- The old Nodemailer/SMTP setup has been replaced with Resend for better reliability
