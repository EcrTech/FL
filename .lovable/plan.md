
## Fix: Loan Amount Showing ₹19,195 Instead of ₹15,000

### Problem

For Hemant Chauhan's application (LA-202602-10003), the Loan Summary and Assessment Dashboard display **₹19,195** (the calculated eligibility amount) instead of the intended **₹15,000** (the approved amount already stored in the database).

**Root cause**: The eligibility calculation produced ₹19,195 as the maximum eligible amount based on FOIR. The system currently uses this eligibility amount as the "single source of truth" for approval, with no way to override it to a lower amount like ₹15,000.

### Two fixes needed

**1. Update the eligibility record in the database**

Change `eligible_loan_amount` from 19,195 to 15,000 in the `loan_eligibility` table for this specific application. This immediately fixes what the user sees in the Loan Summary and Assessment Dashboard.

**2. Allow custom approved amount in the Approval Dialog**

Currently, `ApprovalActionDialog.tsx` automatically uses `eligibility.eligible_loan_amount` as the approved amount with no override option. This should be changed to:
- Pre-fill with the eligibility amount as a suggestion
- Allow the approver to enter a custom (lower) amount before confirming
- Validate that the custom amount does not exceed the eligible amount

### Changes

**Database**: Update `loan_eligibility` for application `11d0a8cf-472a-4dc1-88ba-50215acb3f64` to set `eligible_loan_amount = 15000`

**File: `src/components/LOS/Approval/ApprovalActionDialog.tsx`**
- Add an editable "Approved Amount" input field pre-filled with the eligible amount
- Allow the approver to reduce the amount (but not exceed the eligible amount)
- Use the entered amount (instead of the eligibility amount) when writing `approved_amount` to `loan_applications`

### Technical Details

```typescript
// ApprovalActionDialog.tsx - Add state for custom amount
const [customAmount, setCustomAmount] = useState<string>("");

// Pre-fill when eligibility loads
useEffect(() => {
  if (eligibility?.eligible_loan_amount) {
    setCustomAmount(eligibility.eligible_loan_amount.toString());
  }
}, [eligibility]);

// Use customAmount instead of eligibility.eligible_loan_amount
const approvedAmount = action === "approve" 
  ? Number(customAmount) || eligibility?.eligible_loan_amount 
  : null;
```

The dialog will show an input field:
```tsx
<div>
  <Label>Approved Amount</Label>
  <Input 
    type="number" 
    value={customAmount} 
    onChange={(e) => setCustomAmount(e.target.value)}
    max={eligibility?.eligible_loan_amount}
  />
  <p className="text-xs text-muted-foreground">
    Max eligible: ₹{eligibility?.eligible_loan_amount?.toLocaleString("en-IN")}
  </p>
</div>
```
