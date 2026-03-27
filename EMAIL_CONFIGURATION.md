# Email Configuration Guide

## Changes Made

### 1. Fixed DSN Logo Display in Emails

**File:** [src/emails/BaseEmail.tsx](src/emails/BaseEmail.tsx)

The logo now uses a dynamic URL that checks for `NEXT_PUBLIC_APP_URL` environment variable with a fallback to the production domain.

```tsx
src={process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dsn.png` : 'https://rmo.dsnsandbox.com/dsn.png'}
```

### 2. Centered All Action Buttons

**Files Updated:** All 6 email templates

- ✅ [WelcomeEmail.tsx](src/emails/WelcomeEmail.tsx) - "Log In to Your Account" button (always visible)
- ✅ [NotificationEmail.tsx](src/emails/NotificationEmail.tsx) - Centered action buttons
- ✅ [TimesheetApprovalEmail.tsx](src/emails/TimesheetApprovalEmail.tsx) - "View Timesheet" button
- ✅ [TimesheetReminderEmail.tsx](src/emails/TimesheetReminderEmail.tsx) - "Submit Timesheet" button
- ✅ [LeaveApprovalEmail.tsx](src/emails/LeaveApprovalEmail.tsx) - "View Leave Details" button
- ✅ [PasswordResetEmail.tsx](src/emails/PasswordResetEmail.tsx) - "Reset Password" button

All buttons now have:
- Centered alignment using `buttonContainer` div
- Consistent spacing and styling
- DSN green color (#076C04)

## Environment Setup

### Add to `.env` or `.env.local`:

```bash
# For development (optional - will use fallback if not set)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# For production (recommended)
NEXT_PUBLIC_APP_URL=https://rmo.dsnsandbox.com
```

## Logo Display Options

Since the logo is hosted in your `/public` directory, it needs to be accessible via HTTP. Here are your options:

### Option 1: Use Deployed Domain (Recommended)
Once deployed, the logo will automatically be available at:
- `https://rmo.dsnsandbox.com/dsn.png`

This is the current fallback URL in the code.

### Option 2: Use CDN (For Better Performance)
Upload your logo to a CDN service like:
- Cloudinary
- AWS S3 + CloudFront
- Vercel Blob Storage
- Imgur

Then update the fallback URL in `BaseEmail.tsx`.

### Option 3: Base64 Encoding (Not Recommended)
The logo is ~150KB which creates a ~200KB base64 string. This bloats email size and some clients may reject it.

## Testing Emails

### Quick Test (Using Script):

```bash
# Test all email templates at once
./test-emails.sh your-email@example.com

# Test a specific template
./test-emails.sh your-email@example.com welcome
```

### Manual Testing (Using curl):

```bash
# 1. Notification Email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your@email.com", "template": "notification"}'

# 2. Timesheet Approval Email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your@email.com", "template": "timesheet-approval"}'

# 3. Timesheet Reminder Email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your@email.com", "template": "timesheet-reminder"}'

# 4. Leave Approval Email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your@email.com", "template": "leave-approval"}'

# 5. Password Reset Email
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your@email.com", "template": "password-reset"}'

# 6. Welcome/Onboarding Email ⭐
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"testEmail": "your@email.com", "template": "welcome"}'
```

### Expected Response:

All tests should return:
```json
{
  "success": true,
  "data": {
    "id": "unique-email-id-from-resend"
  }
}
```

## Common Issues

### Logo Not Displaying

**Problem:** Email clients can't access the logo URL

**Solutions:**
1. ✅ Make sure your app is deployed and accessible
2. ✅ Verify `https://rmo.dsnsandbox.com/dsn.png` is accessible in a browser
3. ✅ Check CORS settings if using a CDN
4. ✅ Ensure the logo URL uses HTTPS (not HTTP)

### Button Not Centered

**Problem:** Email client CSS limitations

**Solution:** The button is wrapped in a `div` with `textAlign: 'center'`. This works in most email clients, but some may require table-based layouts. If needed, we can update to use tables.

## Email Template Structure

All emails extend from `BaseEmail.tsx` which provides:
- ✅ DSN Logo header
- ✅ Consistent branding (colors, fonts)
- ✅ Responsive layout
- ✅ Professional footer

## Production Checklist

Before deploying to production:

- [ ] Set `NEXT_PUBLIC_APP_URL` in production environment
- [ ] Verify logo is accessible at production URL
- [ ] Test all email templates with real email addresses
- [ ] Check email rendering in multiple clients (Gmail, Outlook, Apple Mail)
- [ ] Verify RESEND_API_KEY is set in production environment
- [ ] Update default `loginUrl` if your production domain differs from `rmo.dsnsandbox.com`

## Support

For more information about the email system, see:
- [RESEND_SETUP.md](RESEND_SETUP.md) - Email service configuration
- [src/emails/README.md](src/emails/README.md) - Email templates documentation
