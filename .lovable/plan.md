

## NACH Mandate: Change to One-Time Adhoc (Bullet Payment)

### Problem
The eMandate/NACH registration currently defaults to:
- **Sequence Type**: `RCUR` (Recurring) -- hardcoded
- **Frequency**: `MNTH` (Monthly) -- default, with options for Quarterly/Half-Yearly/Yearly

This doesn't match the business requirement: since loans are short-term (1-90 days) with daily EMIs, the NACH should be a **one-time adhoc** collection for bullet repayment of the total amount.

### Changes

**1. `src/components/LOS/Mandate/CreateMandateDialog.tsx`**
- Change `seq_type` from `"RCUR"` to `"OOFF"` (One-Off)
- Change default `frequency` from `"MNTH"` to `"ADHO"` (Adhoc)
- Remove the Frequency dropdown from the form (no longer relevant for one-time payment)
- Set `collection_amount` to the **total repayment amount** (principal + interest) instead of daily EMI
- Remove "Collection Until Cancel" toggle (not applicable for one-time)
- Set `first_collection_date` to the loan maturity/end date (the bullet payment date)
- Update the confirmation summary to reflect one-time bullet payment details

**2. `src/components/LOS/Disbursement/EMandateSection.tsx`**
- Update display text to show "One-time / Bullet" instead of "monthly" frequency labels

**3. `supabase/functions/nupay-create-mandate/index.ts`**
- No structural changes needed -- it already supports `OOFF` seq_type and `ADHO` frequency in its type definitions

### Technical Details
- `seq_type: "OOFF"` = One-Off (single debit)
- `frequency: "ADHO"` = Adhoc (no fixed schedule)
- Collection amount = total repayable (principal + total interest)
- First collection date = loan end date (start date + tenure days)

