

## Fix NACH Mandate Category Code Conflict

### Problem
The eMandate creation is failing because of an invalid parameter combination sent to the Nupay API:
- `frequency: "ADHO"` (Ad-hoc / one-time)
- `category_id: 7` (Loan Installment Payment)

Nupay does not allow ADHO frequency with Category 7. Per their documentation, ADHO must use **Category 15 (Others)**.

### Root Cause
Three locations set the `category_id`, and they are inconsistent:

| Location | Current Value | Should Be |
|---|---|---|
| `CreateMandateDialog.tsx` (frontend, line 149) | `7` | `15` |
| Edge function payload builder (line 149) | `13` (default fallback) | `15` |
| Edge function DB insert (line 245) | `7` (default fallback) | `15` |

### Changes

**File 1: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**
- Line 149: Change `category_id: 7` to `category_id: 15`

**File 2: `supabase/functions/nupay-create-mandate/index.ts`**
- Line 149: Change default `category_id` from `13` to `15` in the Nupay API payload
- Line 245: Change default `category_id` from `7` to `15` in the database insert fallback

### Summary
A one-line fix in the frontend and two default-value corrections in the edge function. No database migration needed since the `category_id` column already accepts any integer.

