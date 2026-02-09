

## Fix: Headers Breaking Across Pages in PDF

### Problem

Section headers (like "DAILY INTEREST ACCRUAL SCHEDULE", "ANNEX A - PART 2") are being split across PDF pages. The header text appears at the bottom of one page and its content starts on the next page.

### Root Cause

1. The **generate (upload) function** is missing the `pagebreak` configuration that the download function already has
2. The CSS `break-before-page` class forces page breaks before sections, but there's no `break-inside: avoid` to prevent html2pdf from splitting a header and its immediately following content across pages

### Fix

**File: `src/components/LOS/Disbursement/CombinedLoanPackCard.tsx`**

1. Add `pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }` to the generate/upload `html2pdf` options (line ~160) to match the download function
2. Add inline CSS in the print styles to prevent headers from being orphaned at page bottoms:

```css
h2, h3, h4 { 
  page-break-after: avoid; 
  break-after: avoid; 
}
table, .mb-6 { 
  page-break-inside: avoid; 
  break-inside: avoid; 
}
```

**Files: Document templates** (4 files)

Add `break-inside: avoid` styling to section wrapper divs to keep headers together with their content:
- `SanctionLetterDocument.tsx`
- `LoanAgreementDocument.tsx`
- `DailyRepaymentScheduleDocument.tsx`
- `KeyFactStatementDocument.tsx`

Each section `div` that contains a heading followed by content will get a style attribute `style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}` to ensure the header stays with at least the first paragraph of its content.

### Files Changed

| File | Change |
|---|---|
| `CombinedLoanPackCard.tsx` | Add `pagebreak` config to generate function; add CSS rules to prevent header orphaning |
| `SanctionLetterDocument.tsx` | Add `breakInside: avoid` to section wrappers |
| `LoanAgreementDocument.tsx` | Add `breakInside: avoid` to section wrappers |
| `DailyRepaymentScheduleDocument.tsx` | Add `breakInside: avoid` to section wrappers |
| `KeyFactStatementDocument.tsx` | Add `breakInside: avoid` to section wrappers |

No database changes needed.
