## Plan: Fire Pixels on Step 1 Referral Form Submission

### Current State

- Pixels (Google Ads & Meta Pixel) are currently integrated but only fire at later stages:
  - **PAN Verified** → Meta `Lead` event
  - **Aadhaar Initiated** → Meta `InitiateCheckout`
  - **Video KYC Complete** → Google Ads Conversion + Meta `CompleteRegistration`
  - **Final Submission** → Meta `Purchase`
- **No pixels fire on Step 1 submission**, missing the earliest lead capture opportunity
- The `loan_applications` table has a `source` field that can store marketing source information
- UTM parameters exist in the URL but are not currently being captured

### Problem

Step 1 of the referral form (Loan Amount, Name, Phone) is when a user shows genuine intent. Currently, if they leave after Step 1, no conversion is tracked. The user wants to:

1. Fire both Google & Meta pixels immediately on Step 1 submission
2. Capture marketing source (UTM parameters if available)
3. Create a "lead" record even if the user doesn't proceed further. Show the source in the lead table. 

### Solution Architecture

#### 1. **Capture UTM Parameters**

Create a utility function to extract UTM parameters from the URL on page load:

- `utm_source` (e.g., "google", "facebook", "direct")
- `utm_medium` (e.g., "cpc", "organic", "referral")
- `utm_campaign` (e.g., "summer_promo")
- Store in context/state for use throughout the form

**New file**: `src/utils/utm.ts`

```typescript
export function captureUTMParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
  };
}

export function getMarketingSource(utmParams: any): string {
  // Map UTM source to human-readable source
  const sourceMap: Record<string, string> = {
    'google': 'Google Ads',
    'facebook': 'Meta Ads',
    'instagram': 'Instagram',
    'direct': 'Direct',
    'organic': 'Organic Search',
  };
  return sourceMap[utmParams?.utm_source?.toLowerCase()] || 'Direct';
}
```

#### 2. **Enhance Analytics for Lead Creation**

Add a new tracking function for Step 1 submission that fires BOTH Google & Meta pixels:

**Update**: `src/utils/analytics.ts`

```typescript
export function trackReferralStep1Lead(loanAmount?: number, utmParams?: any): void {
  console.log('[Analytics] Referral Step 1 Lead:', { loanAmount, utmParams });
  
  // Google Analytics event - Step 1 view
  gtag('event', 'step1_lead_form', {
    event_category: 'Loan Application',
    event_label: 'referral_step_1_basic_info',
    value: loanAmount,
    utm_source: utmParams?.utm_source,
    utm_medium: utmParams?.utm_medium,
    utm_campaign: utmParams?.utm_campaign,
  });
  
  // Meta Lead event for Step 1 submission
  trackMetaEvent('Lead', {
    content_name: 'Referral Loan Step 1',
    value: loanAmount,
    currency: 'INR',
    status: 'lead_form_submit',
  });
}
```

#### 3. **Update useAnalytics Hook**

Add the new tracking function to the hook:

**Update**: `src/hooks/useAnalytics.ts`

```typescript
const trackStep1Lead = useCallback((loanAmount?: number, utmParams?: any) => {
  trackReferralStep1Lead(loanAmount, utmParams);
}, []);
```

#### 4. **Fire Pixels on Step 1 → Step 2 Transition**

When the user clicks "Continue to Contact Information" (moving from `basicInfoSubStep === 1` to `basicInfoSubStep === 2`), fire the lead pixel.

**Update**: `src/pages/ReferralLoanApplication.tsx`

- Capture UTM parameters on component mount
- When user proceeds from LoanRequirementsScreen to ContactConsentScreen, call `trackStep1Lead()` with the loan amount and UTM params
- Pass UTM params through the form flow so they can be used when creating the draft application

#### 5. **Store Marketing Source in Database**

When the draft application is created (before Video KYC), or when the final application is submitted, store the marketing source in the `loan_applications.source` field.

**Update**: `src/pages/ReferralLoanApplication.tsx` (submitApplication function)

```typescript
// Include source field when submitting the application
source: getMarketingSource(utmParams) || 'Direct',
```

### Implementation Steps

1. **Create UTM capture utility** (`src/utils/utm.ts`)
  - Extract `utm_source`, `utm_medium`, `utm_campaign` from query params
  - Provide mapping function to convert UTM source to readable format
2. **Enhance analytics.ts**
  - Add `trackReferralStep1Lead()` function that fires both Google & Meta Lead events
  - Include UTM parameters in the event payload
3. **Update useAnalytics hook**
  - Export `trackStep1Lead` as a usable function in components
4. **Update ReferralLoanApplication.tsx**
  - Capture UTM params on mount using the new utility
  - Fire pixel when transitioning from Step 1 Sub-step 1 → Sub-step 2 (onContinue in LoanRequirementsScreen)
  - Pass UTM params/source through to the draft application creation
  - Include `source` field in the final application submission
5. **Verify pixels fire**
  - Test the referral form on preview/published URLs
  - Check Google Analytics and Meta Pixel event logs
  - Verify UTM parameters are captured and stored

### Expected Outcome

- **Immediate Lead Capture**: Pixels fire as soon as Step 1 is submitted (loan amount, name, phone verified)
- **Source Tracking**: Marketing source is captured from UTM parameters and stored in the database
- **Both Platforms**: Google Analytics and Meta Pixel both receive lead events
- **No Duplicate Fires**: Step 1 lead pixel fires once; subsequent pixels (PAN, Video KYC, Submit) continue to fire as before
- **Fallback**: If no UTM params, source defaults to "Direct"

### Files to Modify

1. `src/utils/utm.ts` (new file)
2. `src/utils/analytics.ts` (add new function)
3. `src/hooks/useAnalytics.ts` (expose new function)
4. `src/pages/ReferralLoanApplication.tsx` (integrate UTM capture and pixel firing)

### Impact

- Captures marketing source for the first time
- Enables earlier conversion tracking on the referral flow
- Provides lead-level analytics instead of just final conversions
- No breaking changes; all existing pixel tracking continues to work