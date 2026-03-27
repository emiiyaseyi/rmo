#!/bin/bash

# Email Testing Script for DSN RMO
# This script tests all email templates

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if email address is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: ./test-emails.sh your-email@example.com [template]${NC}"
    echo ""
    echo "Available templates:"
    echo "  - all (default)"
    echo "  - notification"
    echo "  - timesheet-approval"
    echo "  - timesheet-reminder"
    echo "  - leave-approval"
    echo "  - password-reset"
    echo "  - welcome"
    exit 1
fi

EMAIL=$1
TEMPLATE=${2:-all}
API_URL="http://localhost:3000/api/email/test"

# Function to test a single template
test_template() {
    local template=$1
    local name=$2

    echo -n "Testing $name... "

    response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{\"testEmail\":\"$EMAIL\",\"template\":\"$template\"}")

    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ Success${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        echo "Response: $response"
        return 1
    fi
}

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}DSN RMO Email Template Testing${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Sending test emails to: $EMAIL"
echo ""

# Test specific template or all
if [ "$TEMPLATE" == "all" ]; then
    test_template "notification" "Notification Email"
    test_template "timesheet-approval" "Timesheet Approval Email"
    test_template "timesheet-reminder" "Timesheet Reminder Email"
    test_template "leave-approval" "Leave Approval Email"
    test_template "password-reset" "Password Reset Email"
    test_template "welcome" "Welcome/Onboarding Email"
else
    test_template "$TEMPLATE" "$(echo $TEMPLATE | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2));}1') Email"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Testing complete! Check your inbox.${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
