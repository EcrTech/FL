

# Update Equifax API Credentials

## Overview
Update the existing Equifax secrets with the new UAT credentials provided by Equifax to enable proper API responses.

## Credentials to Update

| Secret Name | New Value |
|-------------|-----------|
| `EQUIFAX_CUSTOMER_ID` | `P00005424` |
| `EQUIFAX_USER_ID` | `REG1_P00005424` |
| `EQUIFAX_PASSWORD` | `XjG@hW9#vKqP3mLz` |
| `EQUIFAX_MEMBER_NUMBER` | `032BGW02-01` |
| `EQUIFAX_SECURITY_CODE` | `2U9` |
| `EQUIFAX_API_URL` | `https://eportuat.equifax.co.in/cir360service/cir360report` |

## Implementation Steps

1. **Update all 6 secrets** using the update_secret tool with the new values from the Equifax portal
2. **Verify the edge function** can read the updated credentials
3. **Test the credit report fetch** to confirm the API responds correctly

## Technical Notes

- The `equifax-credit-report` edge function already reads these secrets from environment variables
- No code changes are required - only secret values need updating
- After updating, the API should return real credit reports instead of falling back to mock data

## Verification

After updating, we can test by:
1. Opening a loan application with a valid PAN number
2. Clicking "Fetch Credit Report" in the Credit Bureau section
3. Confirming real data is returned (not mock data)

