
# Referral Application Form Restructuring

## Overview
Restructure the 2-screen referral loan application to consolidate key fields onto Screen 1, making Screen 2 lighter with only contact details.

---

## Current Layout

| Screen 1 (What do you need?) | Screen 2 (How do we reach you?) |
|------------------------------|----------------------------------|
| Loan Amount                  | Mobile Number (with OTP)         |
| Tenure (Days)                | Email Address (with OTP)         |
| Full Name                    | Office Email (optional)          |
|                              | **Consents (3 checkboxes)**      |

## New Layout

| Screen 1 (What do you need?) | Screen 2 (How do we reach you?) |
|------------------------------|----------------------------------|
| Loan Amount                  | Tenure (Days)                    |
| **Mobile Number (with OTP)** | Email Address (with OTP)         |
| Full Name                    | Office Email (optional)          |
| **Consents (3 checkboxes)**  |                                  |

---

## File Changes

### 1. LoanRequirementsScreen.tsx

**Remove:**
- Tenure input field, slider, and validation (`tenureDays`)

**Add:**
- Mobile number field with +91 prefix (from ContactConsentScreen)
- OTP verification UI (input + verify button)
- Auto-send OTP logic (500ms debounce on 10-digit detection)
- Verification status handling and timer
- All 3 consent checkboxes:
  - Household income > ₹3 Lakh/year
  - Terms, Privacy Policy & Gradation of Risk
  - CKYC verification & communications consent

**Props Interface Update:**
```typescript
interface LoanRequirementsScreenProps {
  formData: {
    name: string;
    requestedAmount: number;
    phone: string;  // Added
  };
  onUpdate: (data: Partial<{ name: string; requestedAmount: number; phone: string }>) => void;
  consents: {  // Added
    householdIncome: boolean;
    termsAndConditions: boolean;
    aadhaarConsent: boolean;
  };
  onConsentChange: (consent: 'householdIncome' | 'termsAndConditions' | 'aadhaarConsent', value: boolean) => void;  // Added
  verificationStatus: { phoneVerified: boolean };  // Added
  onVerificationComplete: (type: 'phone') => void;  // Added
  onContinue: () => void;
}
```

**Validation Update:**
```
canContinue = isValidAmount && isValidPhone && phoneVerified && isValidName && allConsentsChecked
```

---

### 2. ContactConsentScreen.tsx

**Remove:**
- Mobile number field and all phone OTP logic
- All 3 consent checkboxes and related state
- `consents` and `onConsentChange` from props

**Add:**
- Tenure input field with slider (1-90 days range)

**Props Interface Update:**
```typescript
interface ContactConsentScreenProps {
  formData: {
    email: string;
    officeEmail: string;
    tenureDays: number;  // Added
  };
  onUpdate: (data: Partial<{ email: string; officeEmail: string; tenureDays: number }>) => void;
  verificationStatus: {
    emailVerified: boolean;
    officeEmailVerified: boolean;
    // phoneVerified removed
  };
  onVerificationComplete: (type: 'email' | 'officeEmail') => void;
  onContinue: () => void;
}
```

**Validation Update:**
```
canContinue = isValidTenure && isValidEmail && emailVerified && officeEmailValid
```

**Title Update:**
- Keep "How do we reach you?" as header
- Add tenure as first field (before email)

---

### 3. ReferralLoanApplication.tsx (Parent Component)

**Update screen data passing:**

**Screen 1 (LoanRequirementsScreen):**
- Pass: `name`, `requestedAmount`, `phone`
- Pass: `consents`, `onConsentChange`
- Pass: `verificationStatus.phoneVerified`, `onVerificationComplete('phone')`

**Screen 2 (ContactConsentScreen):**
- Pass: `email`, `officeEmail`, `tenureDays`
- Pass: `verificationStatus.emailVerified`, `verificationStatus.officeEmailVerified`
- Remove: `phone`, `phoneVerified`, `consents`

---

## UI Layout for Screen 1 (New)

```text
┌─────────────────────────────────┐
│ 💰 What do you need?            │
│ Tell us about your loan requirement │
├─────────────────────────────────┤
│ ₹ LOAN AMOUNT *                 │
│ ┌─────────────────────────────┐ │
│ │ ₹ 25,000                    │ │
│ └─────────────────────────────┘ │
│ ──●────────────────────────── │
│ ₹5,000                ₹1,00,000 │
├─────────────────────────────────┤
│ 📱 MOBILE NUMBER *              │
│ ┌────┬────────────────────────┐ │
│ │+91 │ Enter 10-digit mobile  │ │
│ └────┴────────────────────────┘ │
│ [OTP verification area if sent] │
├─────────────────────────────────┤
│ 👤 FULL NAME (AS PER PAN) *     │
│ ┌─────────────────────────────┐ │
│ │ Enter your full name        │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ DECLARATIONS                    │
│ ☑ Household income > ₹3 Lakh   │
│ ☑ I agree to Terms, Privacy... │
│ ☑ I consent to CKYC verification│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │      Continue →             │ │
│ └─────────────────────────────┘ │
│ 🔒 Your data is 256-bit secure  │
└─────────────────────────────────┘
```

---

## UI Layout for Screen 2 (New)

```text
┌─────────────────────────────────┐
│ 📞 How do we reach you?         │
│ We'll send updates on these     │
├─────────────────────────────────┤
│ 📅 TENURE (DAYS) *              │
│ ┌─────────────────────────────┐ │
│ │ 30                          │ │
│ └─────────────────────────────┘ │
│ ──●────────────────────────── │
│ 1 day                    90 days│
├─────────────────────────────────┤
│ 📧 EMAIL ADDRESS *              │
│ ┌─────────────────────────────┐ │
│ │ Enter your email            │ │
│ └─────────────────────────────┘ │
│ [OTP verification area if sent] │
├─────────────────────────────────┤
│ 🏢 OFFICE EMAIL (Optional)      │
│ ┌─────────────────────────────┐ │
│ │ Enter work email            │ │
│ └─────────────────────────────┘ │
│ [OTP verification area if sent] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ Continue to PAN Verification│ │
│ └─────────────────────────────┘ │
│ 🔒 Secure · RBI Registered      │
└─────────────────────────────────┘
```

---

## Technical Implementation Notes

### OTP Logic Migration
The complete phone OTP verification logic moves from `ContactConsentScreen` to `LoanRequirementsScreen`:
- State variables: `phoneOtpSent`, `phoneOtp`, `phoneSessionId`, `sendingPhoneOtp`, `verifyingPhone`, `phoneTimer`, `phoneTestOtp`
- Auto-send effect (500ms debounce on 10-digit input)
- `sendOtp('phone')` and `verifyOtp('phone')` functions
- Timer management with `startTimer` and `formatTimer` utilities

### Consent Checkbox Styling
Preserve the exact styling from ContactConsentScreen:
- 22x22px checkbox with rounded-md and border-2
- 13px text with muted-foreground color
- Links styled with text-primary and underline

### Mobile Considerations
Screen 1 will now have more content, but remains scrollable with the `overflow-y-auto` container. The 52px input heights and 14px border-radius design system are maintained.

---

## Dependencies
No new dependencies - this is a restructuring of existing components using current UI patterns and OTP infrastructure.
