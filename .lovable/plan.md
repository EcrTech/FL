

## Fix: Allow Single Verified Source for PAN Number Validation

### Problem
The Document Data Verification table shows "Insufficient Data" for PAN Number even when the PAN Card OCR has extracted a valid PAN. The current logic requires **at least 2 sources** with data to display a status, but since PAN verification is mandatory, a single verified source should be sufficient.

### Solution
Update the match status logic to treat verified mandatory fields (like PAN) as valid with just one source. When only one source has data and it's from a verified document (PAN Card), display "Valid" status instead of "Insufficient Data".

---

### File to Modify

| File | Change |
|------|--------|
| `src/components/LOS/DocumentDataVerification.tsx` | Update match status logic to allow single verified source for PAN field |

---

### Code Changes

**1. Add new match status type (line 23)**

```typescript
// Before
matchStatus: "match" | "partial" | "mismatch" | "insufficient";

// After
matchStatus: "match" | "partial" | "mismatch" | "insufficient" | "valid";
```

**2. Update match calculation logic (lines 216-235)**

Add special handling for mandatory verified fields:

```typescript
return fields.map((field) => {
  const nonEmptyValues = field.values.filter((v) => v.value && v.value.trim() !== "");

  // For PAN field: if only PAN Card source has value, it's valid (mandatory verified source)
  if (field.field === "pan" && nonEmptyValues.length === 1) {
    const singleSource = nonEmptyValues[0];
    if (singleSource.source === "PAN Card" && singleSource.value) {
      return { ...field, matchStatus: "valid" as const };
    }
  }

  if (nonEmptyValues.length < 2) {
    return { ...field, matchStatus: "insufficient" as const };
  }

  // ... rest of existing match logic
});
```

**3. Add icon for "valid" status (line 248)**

```typescript
case "valid":
  return <CheckCircle className="h-4 w-4 text-green-500" />;
```

**4. Add badge for "valid" status (line 260)**

```typescript
case "valid":
  return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Valid</Badge>;
```

---

### Expected Result

| Source | Value | Status |
|--------|-------|--------|
| Application | - | |
| PAN Card | PEKPK6738E | |
| Form 16 | - | **Valid** ✅ |

The PAN Number row will show "Valid" with a green checkmark when only the verified PAN Card source has data, since PAN verification is mandatory and the extracted value is from a trusted source.

