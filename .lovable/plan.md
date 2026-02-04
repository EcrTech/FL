
# Configure Nupay eMandate Production URLs

## Overview
Your production eMandate URLs from Nupay use a different base path than what's currently configured. We need to update the production endpoint in the database.

## URL Mapping

| Purpose | Nupay URL | How System Constructs It |
|---------|-----------|-------------------------|
| Auth Token | `https://nupaybiz.com/autonach/Auth/token` | `{api_endpoint}/Auth/token` |
| Create Mandate | `https://nupaybiz.com/autonach/api/EMandate/eManadate` | `{api_endpoint}/api/EMandate/eManadate` |
| Get Bank List | `https://nupaybiz.com/autonach/api/EMandate/getBankList` | `{api_endpoint}/api/EMandate/getBankList` |
| Get Category List | `https://nupaybiz.com/autonach/api/EMandate/getCategoryList` | `{api_endpoint}/api/EMandate/getCategoryList` |
| Get Status | `https://nupaybiz.com/autonach/api/EMandate/getStatus/{id}` | `{api_endpoint}/api/EMandate/getStatus/{id}` |

## What Needs to Change

**Current Production Endpoint:**
`https://nach.nupaybiz.com`

**Correct Production Endpoint:**
`https://nupaybiz.com/autonach`

## Steps

1. Navigate to **LOS Settings** then **Nupay eMandate** (the path is `/los/settings/nupay`)
2. In the **Production Environment** section, update the **eMandate API Endpoint** field from:
   - `https://nach.nupaybiz.com`
   to:
   - `https://nupaybiz.com/autonach`
3. Click **Save Configuration**

No code changes are required - the edge functions already construct URLs correctly by appending paths like `/Auth/token` and `/api/EMandate/eManadate` to the base endpoint.

## Technical Details

The following edge functions use the `api_endpoint` from `nupay_config`:
- `nupay-authenticate` - appends `/Auth/token`
- `nupay-create-mandate` - appends `/api/EMandate/eManadate`
- `nupay-get-banks` - appends `/api/EMandate/getBankList`
- `nupay-get-status` - appends `/api/EMandate/getStatus/{id}`

All will work correctly once the production endpoint is updated to `https://nupaybiz.com/autonach`.
