

## Cleanup: Fix Remaining Stale Logic Across the System

The investigation found **5 remaining issues** from recent changes that were not fully propagated.

---

### Issues Found

| # | File | Problem |
|---|---|---|
| 1 | `SanctionGenerator.tsx` | Stores `processing_fee: 0` and `net_disbursement_amount: approvedAmount` at sanction creation -- no 10% fee or GST deduction |
| 2 | `AssessmentDashboard.tsx` | Displays tenure as "X months" (`days / 30`) instead of "X days" |
| 3 | `FeatureHighlights.tsx` | Marketing text shows "12.65% p.a." -- stale annual rate model |
| 4 | `ApplicationSummary.tsx` | GST on processing fee has no fallback for legacy records where `processing_fee = 0` |
| 5 | `DisbursementForm.tsx` | Uses `processing_fee || 0` -- no fallback to 10% for legacy records |

---

### Plan

#### 1. Fix `SanctionGenerator.tsx` -- Store correct processing fee at creation

This is the **root cause** of all legacy data issues. When a sanction is created, it should store the correct processing fee and net disbursal upfront.

Change:
- `processing_fee: Math.round(approvedAmount * 0.10)`
- `net_disbursement_amount: approvedAmount - processingFee - Math.round(processingFee * 0.18)`

This prevents future records from having stale `0` values.

#### 2. Fix `AssessmentDashboard.tsx` -- Show days not months

Replace:
```
{Math.round(eligibility.recommended_tenure_days / 30)} months
```
With:
```
{eligibility.recommended_tenure_days} days
```

#### 3. Fix `FeatureHighlights.tsx` -- Update marketing text

Change "Starting from 12.65% p.a." to "1% per day" (or whatever the standard daily rate is) to match the actual product model.

#### 4. Fix `ApplicationSummary.tsx` -- Add processing fee fallback for legacy records

The sanction details section shows GST as `sanction.processing_fee * 0.18`. For legacy records where `processing_fee = 0`, this shows Rs.0. Add the same 10% fallback used elsewhere:
```
const pf = sanction.processing_fee || Math.round(sanction.sanctioned_amount * 0.10);
```

#### 5. Fix `DisbursementForm.tsx` -- Add processing fee fallback

Same pattern: replace `sanction?.processing_fee || 0` with `sanction?.processing_fee || Math.round(approvedAmount * 0.10)`.

---

### Files Changed

| File | Change |
|---|---|
| `src/components/LOS/Sanction/SanctionGenerator.tsx` | Calculate and store 10% processing fee + GST-adjusted net disbursal |
| `src/components/LOS/Assessment/AssessmentDashboard.tsx` | Display tenure as days instead of months |
| `src/components/ReferralApplication/FeatureHighlights.tsx` | Update interest rate text to daily model |
| `src/components/LOS/ApplicationSummary.tsx` | Add 10% fallback for legacy processing fee |
| `src/components/LOS/Disbursement/DisbursementForm.tsx` | Add 10% fallback for legacy processing fee |

