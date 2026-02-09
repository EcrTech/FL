

## Change Mandate Sequence Type from OOFF to RCUR

Per Nupay's recommendation, the mandate sequence type needs to be changed from `OOFF` (One-Off) to `RCUR` (Recurring) to resolve the frequency validation error.

### Changes

**File 1: `src/components/LOS/Mandate/CreateMandateDialog.tsx`**
- Line 147: Change `seq_type: "OOFF"` to `seq_type: "RCUR"`

**File 2: `supabase/functions/nupay-create-mandate/index.ts`**
- The edge function already passes through `requestData.seq_type` directly, so no change needed there -- the frontend value flows through automatically.

### Summary
A single-line change in the frontend component. The edge function maps `seq_type` to `seq_tp` in the Nupay payload and passes it through as-is, so only the source value needs updating.

