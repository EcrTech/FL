

# Fix: Deploy Missing Edge Functions for Status Checks

## Problem

The E-Sign status check and eMandate status check are both failing with "Failed to send a request to the Edge Function" because the following edge functions exist in the codebase but have **not been deployed**:

1. `nupay-esign-status` - Used for checking E-Sign document status
2. `nupay-get-status` - Used for checking eMandate registration status

## Solution

Deploy both edge functions. No code changes are needed -- the functions already exist and are correctly written.

### Functions to Deploy

| Function | Purpose |
|----------|---------|
| `nupay-esign-status` | Checks Nupay E-Sign document signing status |
| `nupay-get-status` | Checks Nupay eMandate registration status |

## Expected Outcome

After deployment:
- Clicking the refresh/status check button on the E-Sign badge will successfully query Nupay for the signing status
- Clicking "Check Status" on the eMandate section will correctly fetch and update the mandate status
- The "Status check failed" error will no longer appear

