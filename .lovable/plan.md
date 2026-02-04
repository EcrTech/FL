
# Configure Nupay E-Sign Production URLs

## Overview
Your production E-Sign URLs share the same base endpoint as eMandate, so we simply need to update the E-Sign API Endpoint in the database.

## URL Mapping

| Purpose | Nupay URL | How System Constructs It |
|---------|-----------|-------------------------|
| Auth Token | `https://nupaybiz.com/autonach/Auth/token` | `{esign_api_endpoint}/Auth/token` |
| Upload Document | `https://nupaybiz.com/autonach/api/SignDocument/addRequestFile` | `{esign_api_endpoint}/api/SignDocument/addRequestFile` |
| Process for Sign | `https://nupaybiz.com/autonach/api/SignDocument/processForSign` | `{esign_api_endpoint}/api/SignDocument/processForSign` |

## Current vs Required Configuration

| Field | Current Value | Required Value |
|-------|---------------|----------------|
| eMandate API Endpoint | `https://nupaybiz.com/autonach` | ✅ Already correct |
| E-Sign API Endpoint | `https://esign.nupaybiz.com` | `https://nupaybiz.com/autonach` |

## What Needs to Change

Update the **E-Sign API Endpoint** field from:
- `https://esign.nupaybiz.com`

to:
- `https://nupaybiz.com/autonach`

## Steps

1. On the current page (**LOS Settings → Nupay eMandate**), scroll to the **Production Environment** section
2. Update the **E-Sign API Endpoint** field to: `https://nupaybiz.com/autonach`
3. Click **Save Configuration**

## Technical Details

The edge function `nupay-esign-request` at line 362 uses `esign_api_endpoint` if available, falling back to `api_endpoint`:

```typescript
const apiEndpoint = configData.esign_api_endpoint || configData.api_endpoint;
```

Since both eMandate and E-Sign now share the same production base URL (`https://nupaybiz.com/autonach`), they will both work correctly once the E-Sign endpoint is updated.

No code changes are required.
