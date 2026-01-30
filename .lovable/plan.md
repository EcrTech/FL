
# Update WhatsApp Template for E-Sign Notifications

## Summary
Update the `send-esign-notifications` edge function to use your approved 2-variable WhatsApp template instead of the current 3-variable structure.

## Your Approved Template
```
Hello {{1}},

Congratulations for your loan approval. Here is the link of the loan agreement for your electronic signature.

Please click the link below to review and sign the document:

{{2}}

This link is valid for 72 hours.
```

**Variable Mapping:**
- `{{1}}` = Signer Name (e.g., "SAMAN KHAN")
- `{{2}}` = Signing URL (e.g., "https://nachuat.nupaybiz.com/EsignWidget?signer_id=...")

## Changes Required

### File: `supabase/functions/send-esign-notifications/index.ts`

**1. Update the `sendWhatsAppNotification` function signature (lines 111-122)**
- Remove the `documentType` parameter since it's no longer used in the template

**2. Update the WhatsApp payload (lines 147-163)**
```typescript
// Current (3 variables):
body_values: [signerName, documentLabel, signerUrl],

// New (2 variables):
body_values: [signerName, signerUrl],
```

**3. Remove unused `documentLabel` variable (line 139-140)**
- Since the template no longer references document type, remove this logic

**4. Update the function call (lines 260-266)**
- Remove `document_type` from the function call parameters

## After Deployment
Test by initiating an E-Sign request on a sanctioned loan application. The signer should receive:
- **WhatsApp message** with their name and the signing link
- **Email** with the full HTML template (unchanged)
