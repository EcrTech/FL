

## Change Customer ID Format to 6 Digits

### Current State
- Format: `CUST-YYYYMM-XXXXX` (5 digits, e.g., `CUST-202602-00184`)
- Sequence is currently at value 184

### Changes
A single database migration to:

1. **Update the trigger function** `set_customer_id` to use `LPAD(..., 6, '0')` instead of `LPAD(..., 5, '0')` for 6-digit padding (e.g., `CUST-202602-000001`)

2. **Backfill existing records** -- update all current `customer_id` values to use 6-digit format by extracting the numeric suffix and re-padding it

### Result
- New IDs: `CUST-YYYYMM-000185`, `CUST-YYYYMM-000186`, etc.
- Existing IDs updated from `CUST-202602-00012` to `CUST-202602-000012`

### Notes
- The sequence itself does not need resetting -- it already starts from 1 and is at 184
- Only the display padding changes from 5 to 6 digits

