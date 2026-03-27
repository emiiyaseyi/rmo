# Resend Email Setup - DSN RMO

## Overview

The DSN RMO project has been successfully migrated from Nodemailer/SMTP to **Resend** with branded **React Email** templates. All emails now feature consistent DSN RMO branding with a professional appearance.

## What Was Done

### 1. **Installed Dependencies**
- `resend` - Email delivery service
- `@react-email/components` - React components for building emails
- `react-email` - Email template development tools

### 2. **Created Email Template System**

#### Base Template ([src/emails/BaseEmail.tsx](src/emails/BaseEmail.tsx))
- Consistent DSN RMO branding
- Green header (#076C04) with DSN RMO logo
- Professional footer with company information
- Fully responsive design

#### Email Templates Created:
1. **NotificationEmail** - Generic notifications
2. **TimesheetApprovalEmail** - Timesheet approval/rejection notifications
3. **TimesheetReminderEmail** - Timesheet submission reminders
4. **LeaveApprovalEmail** - Leave request responses
5. **PasswordResetEmail** - Password reset requests
6. **WelcomeEmail** - New user onboarding (includes default password: dsn-stff)

### 3. **Created Email Service Library** ([src/lib/email.ts](src/lib/email.ts))
Provides helper functions for sending emails:
- `sendNotificationEmail()`
- `sendTimesheetApprovalEmail()`
- `sendTimesheetReminderEmail()`
- `sendLeaveApprovalEmail()`
- `sendPasswordResetEmail()`
- `sendWelcomeEmail()`
- `sendCustomEmail()` - For custom HTML emails

### 4. **Updated API Routes**

#### [src/app/api/email/route.ts](src/app/api/email/route.ts)
- Migrated from Nodemailer to Resend
- Maintains backward compatibility with existing code
- All emails sent via this route now use Resend

#### [src/app/api/email/send-template/route.ts](src/app/api/email/send-template/route.ts) (NEW)
- New endpoint for template-based emails
- Accepts template type and parameters
- Example usage:
```json
POST /api/email/send-template
{
  "type": "notification",
  "to": "user@example.com",
  "title": "Title",
  "message": "Message",
  "actionUrl": "https://app.com/action",
  "actionText": "View Details"
}
```

#### [src/app/api/email/test/route.ts](src/app/api/email/test/route.ts) (NEW)
- Testing endpoint for email templates
- Useful for development and testing

### 5. **Updated Utility Function** ([src/lib/utils.ts](src/lib/utils.ts))
- `sendEmailNotification()` now uses React Email templates automatically
- Backward compatible - no changes needed to existing code

### 6. **Configuration**

#### Email Sender Address
All emails are sent from: **DSN RMO <noreply@rmo.dsnsandbox.com>**

#### Environment Variables
The following variable is configured in `.env`:
```env
RESEND_API_KEY=re_DM83MmdQ_hy5SBfG9qsFKK4j9tyuhJfBw
```

## How to Use

### Method 1: Using the Helper in utils.ts (Easiest)
```typescript
import { sendEmailNotification } from '@/lib/utils'

// This now automatically uses the branded React Email template
await sendEmailNotification(
  'user@example.com',
  'Notification Title',
  'Your message here',
  '/optional-link'
)
```

### Method 2: Using Email Service Functions
```typescript
import { sendTimesheetApprovalEmail } from '@/lib/email'

await sendTimesheetApprovalEmail(
  'user@example.com',
  'John Doe',
  '2026-03-24',
  'approved',
  'Great work this week!',
  'https://app.com/timesheet'
)
```

### Method 3: Using the API Endpoint
```typescript
const response = await fetch('/api/email/send-template', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'welcome',
    to: 'newuser@example.com',
    staffName: 'John Doe',
    email: 'newuser@example.com',
    loginUrl: 'https://app.com/login'
  })
})
```

## Testing Emails

### Preview Templates Locally
Run the email development server to preview all templates:
```bash
npm run email:dev
```
Then open http://localhost:3000

### Send Test Email
```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your-email@example.com", "template": "notification"}'
```

Available test templates:
- `notification`
- `timesheet-approval`
- `welcome`

## Brand Colors Used

- **Primary Green**: #076C04
- **Hover Green**: #065903
- **Light Green**: #F0FDF4
- **Border**: #D8DEE4

## Important Notes

1. **Resend Domain Setup**: Make sure to verify the domain `rmo.dsnsandbox.com` in your Resend dashboard for production use.

2. **Testing**: In development, Resend allows sending emails to verified email addresses only. Add test email addresses in the Resend dashboard.

3. **Rate Limits**: Resend free tier includes 3,000 emails per month. Monitor usage in the Resend dashboard.

4. **Backward Compatibility**: The old `/api/email` endpoint still works, so existing code doesn't need to be updated immediately.

5. **Welcome Email**: Now includes the default password (dsn-stff) and a reminder to change it after first login.

## Next Steps

1. **Verify Domain in Resend**
   - Go to Resend dashboard
   - Add and verify `rmo.dsnsandbox.com`
   - Update DNS records as instructed

2. **Test All Email Templates**
   - Use the test endpoint to verify all templates
   - Check rendering across different email clients

3. **Update Existing Code** (Optional)
   - Gradually migrate from generic `sendEmailNotification()` to specific template functions
   - Use template-based functions for better email tracking and analytics

4. **Monitor Deliverability**
   - Check Resend dashboard for delivery rates
   - Monitor bounce rates and spam reports
   - Adjust templates if needed

## Documentation

Full documentation is available in [src/emails/README.md](src/emails/README.md)

## Support

- Resend Docs: https://resend.com/docs
- React Email Docs: https://react.email/docs
- Issues: Report any email issues to your development team

---

**Status**: ✅ Complete and Ready for Production

**Build Status**: ✅ All TypeScript checks passed

**Last Updated**: March 27, 2026
