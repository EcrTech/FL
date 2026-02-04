
# Implementation Plan: Google Ads & Meta Pixel Tracking Integration

## Overview
This plan implements comprehensive tracking for Google Ads and Meta (Facebook) Ads across the loan application flows, specifically targeting the Referral Loan Application (`/apply/ref/:referralCode`) which has a 4-step verification process (Requirements → PAN → Aadhaar → Video KYC).

---

## Tracking Requirements Summary

### Google Ads
| Event | Trigger Point | Conversion ID |
|-------|--------------|---------------|
| Global Tag | All pages | `AW-17871680753` |
| Step 1 Conversion | Loan requirements form viewed | TBD (not in PDF) |
| Step 2 Conversion | PAN verification started | TBD (not in PDF) |
| Step 3 Conversion | Aadhaar verification started | TBD (not in PDF) |
| Step 4 Conversion | Video KYC completed | `AW-17871680753/O8oJCNz54u8bEPHp8MlC` |

### Meta (Facebook) Pixel
| Event | Trigger Point | Pixel ID |
|-------|--------------|----------|
| Base Pixel | All pages | `2454408188319767` |
| PageView | All pages (auto) | - |
| SubmitApplication | Referral form step 1 completion | - |
| CompleteRegistration | All verifications done | - |
| Purchase | Loan application submitted | - |

---

## Technical Implementation

### Phase 1: Create Analytics Utility Module

**New file: `src/utils/analytics.ts`**

This module will centralize all tracking logic with TypeScript type safety:

```typescript
// Key exports:
export const gtag: GtagFunction;
export const fbq: FbqFunction;

// Google Ads conversion tracking
export function trackGoogleConversion(
  conversionId: string,
  options?: { value?: number; currency?: string; transactionId?: string }
): void;

// Meta standard events
export function trackMetaEvent(
  eventName: 'PageView' | 'SubmitApplication' | 'CompleteRegistration' | 'Purchase' | 'Lead',
  params?: Record<string, any>
): void;

// Loan application specific events
export function trackLoanStep(step: 1 | 2 | 3 | 4): void;
export function trackLoanConversion(applicationId: string, amount?: number): void;
```

### Phase 2: Add Tracking Scripts to index.html

**File: `index.html`**

Add the following scripts inside the `<head>` section:

```html
<!-- Google Ads Global Tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-17871680753"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-17871680753');
</script>

<!-- Meta Pixel Base Code -->
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '2454408188319767');
  fbq('track', 'PageView');
</script>
<noscript>
  <img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=2454408188319767&ev=PageView&noscript=1"/>
</noscript>
```

### Phase 3: Integrate Tracking into Loan Application Flow

**Files to modify:**

1. **`src/pages/ReferralLoanApplication.tsx`**
   - Track step transitions
   - Track `SubmitApplication` on step 1 completion
   - Track `CompleteRegistration` after all verifications
   - Track `Purchase` on successful submission

2. **`src/components/ReferralApplication/PANVerificationStep.tsx`**
   - Track Google Ads conversion for Step 2
   - Track Meta `Lead` event on PAN verification success

3. **`src/components/ReferralApplication/AadhaarVerificationStep.tsx`**
   - Track Google Ads conversion for Step 3

4. **`src/components/ReferralApplication/VideoKYCStep.tsx`**
   - Track Google Ads final conversion (`O8oJCNz54u8bEPHp8MlC`) on completion
   - This is the primary conversion event for Google Ads

5. **`src/pages/PublicLoanApplication.tsx`**
   - Add similar tracking for the 7-step public application flow

### Phase 4: Create useAnalytics Hook

**New file: `src/hooks/useAnalytics.ts`**

A React hook for easy tracking integration:

```typescript
export function useAnalytics() {
  const trackEvent = useCallback((eventName: string, params?: object) => {
    // Google Analytics event
    gtag('event', eventName, params);
    
    // Meta custom event
    fbq('trackCustom', eventName, params);
  }, []);

  const trackLoanApplicationStep = useCallback((step: number, data?: object) => {
    // Track step progression
  }, []);

  return {
    trackEvent,
    trackLoanApplicationStep,
    trackConversion,
    trackPageView,
  };
}
```

---

## Event Mapping

### Referral Loan Application Flow (`/apply/ref/:referralCode`)

```text
Step 1: Loan Requirements → Contact Consent
├── Google: pageview (automatic)
├── Meta: PageView (automatic)
└── Meta: SubmitApplication (on Continue click)

Step 2: PAN Verification
├── Google: conversion event (step 2)
└── Meta: Lead (on successful PAN verification)

Step 3: Aadhaar/DigiLocker
├── Google: conversion event (step 3)
└── Meta: InitiateCheckout (on DigiLocker redirect)

Step 4: Video KYC
├── Google: FINAL CONVERSION (AW-17871680753/O8oJCNz54u8bEPHp8MlC)
├── Meta: CompleteRegistration (on video upload success)
└── Meta: Purchase (on application submission)
```

### Public Loan Application Flow (`/apply/:slug`)

```text
Steps 1-7 → Step 8 (Success)
├── Track step progression as custom events
├── Meta: SubmitApplication on personal details (step 2)
├── Meta: CompleteRegistration on review (step 6)
└── Meta: Purchase on consent OTP success
```

---

## Implementation Checklist

### Setup Tasks
- [ ] Add Google Ads global tag to `index.html`
- [ ] Add Meta Pixel base code to `index.html`
- [ ] Create `src/utils/analytics.ts` utility module
- [ ] Create `src/hooks/useAnalytics.ts` hook
- [ ] Add TypeScript type declarations for `gtag` and `fbq`

### Referral Application Integration
- [ ] Add step tracking to `ReferralLoanApplication.tsx`
- [ ] Add PAN verification conversion to `PANVerificationStep.tsx`
- [ ] Add Aadhaar verification tracking to `AadhaarVerificationStep.tsx`
- [ ] Add Video KYC final conversion to `VideoKYCStep.tsx`
- [ ] Add application submission tracking

### Public Application Integration
- [ ] Add step tracking to `PublicLoanApplication.tsx`
- [ ] Add consent completion tracking

### Testing Tasks
- [ ] Verify Google Ads conversions in Tag Assistant
- [ ] Verify Meta Pixel events in Facebook Events Manager
- [ ] Test full application flow end-to-end
- [ ] Confirm no duplicate event firing

---

## Code Examples

### Tracking Video KYC Completion (Final Conversion)

```typescript
// In VideoKYCStep.tsx - onComplete handler
import { trackGoogleConversion, trackMetaEvent } from '@/utils/analytics';

const handleVideoUploadSuccess = () => {
  // Google Ads final conversion
  trackGoogleConversion('AW-17871680753/O8oJCNz54u8bEPHp8MlC', {
    value: 1.0,
    currency: 'INR',
    transactionId: applicationId,
  });
  
  // Meta conversion
  trackMetaEvent('CompleteRegistration', {
    content_name: 'Video KYC',
    status: 'complete',
  });
  
  // Continue with existing logic
  onComplete();
};
```

### Tracking Application Submission

```typescript
// In ReferralLoanApplication.tsx - submitApplication function
import { trackMetaEvent } from '@/utils/analytics';

const submitApplication = async () => {
  // ... existing submission logic
  
  if (submissionSuccess) {
    trackMetaEvent('Purchase', {
      value: basicInfo.requestedAmount,
      currency: 'INR',
      content_name: 'Loan Application',
      content_ids: [applicationNumber],
    });
  }
};
```

---

## Security Considerations

1. **No PII in tracking**: Never send PAN, Aadhaar, or personal details to analytics
2. **Transaction IDs**: Use application IDs only, not sensitive identifiers
3. **Value tracking**: Only send loan amount for conversion value optimization

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `index.html` | Modify | Add Google & Meta base scripts |
| `src/utils/analytics.ts` | Create | Centralized tracking utilities |
| `src/hooks/useAnalytics.ts` | Create | React hook for components |
| `src/types/analytics.d.ts` | Create | TypeScript declarations |
| `src/pages/ReferralLoanApplication.tsx` | Modify | Add step tracking |
| `src/components/ReferralApplication/PANVerificationStep.tsx` | Modify | Step 2 conversion |
| `src/components/ReferralApplication/AadhaarVerificationStep.tsx` | Modify | Step 3 tracking |
| `src/components/ReferralApplication/VideoKYCStep.tsx` | Modify | Final conversion |
| `src/pages/PublicLoanApplication.tsx` | Modify | Public flow tracking |

---

## Notes

1. The PDF shows specific conversion IDs only for Step 4 (Video KYC). If additional conversion IDs are needed for Steps 1-3, they will need to be provided or created in Google Ads console.

2. Meta Pixel standard events are used where applicable (`PageView`, `Lead`, `SubmitApplication`, `CompleteRegistration`, `Purchase`) for better optimization.

3. Both tracking systems will fire on all public application routes. Internal routes (dashboard, etc.) will only have PageView tracking.
