
# SMS Templates Implementation Plan

## Context
You've shared your DLT-registered OTP template from TATA Tele portal:

| Field | Value |
|-------|-------|
| Template Name | OTP |
| DLT Template ID | 1607100000000371566 |
| Content | `Your PaisaaSaarthi OTP is {#var#}. Valid for 10 mins` |
| Variable | var1 = OTP |
| Category | Banking / Insurance / Financial Products |

---

## Current Gap
The Templates page currently has WhatsApp and Email tabs but **no SMS tab**. We need to add SMS template management with DLT compliance support.

---

## Implementation Plan

### Phase 1: Database - SMS Templates Table

Create a dedicated `sms_templates` table:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization (FK) |
| name | text | Template name (e.g., "OTP") |
| dlt_template_id | text | DLT registered ID (required) |
| content | text | Message content with `{#var#}` placeholders |
| variables | jsonb | Variable mapping `[{dlt_var: "#var#", name: "otp", description: "OTP code"}]` |
| category | text | transactional/promotional |
| language | text | English, Hindi, etc. |
| char_count | integer | Character count for reference |
| is_active | boolean | Enable/disable |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update |

Update `sms_automation_rules.sms_template_id` to reference this new table.

---

### Phase 2: Frontend - SMS Tab in Templates Page

Add an SMS tab to `src/pages/Templates.tsx`:

```text
Templates
├── WhatsApp (existing)
├── Email (existing)
└── SMS (NEW)
    ├── List all SMS templates
    ├── Create SMS Template button
    └── Template cards with:
        - Name & DLT Template ID
        - Content preview
        - Variable badges
        - Character count indicator
        - Edit/Delete actions
```

---

### Phase 3: SMS Template Form Dialog

Create `src/components/Templates/SMSTemplateDialog.tsx`:

**Form Fields:**
1. **Template Name** - Friendly name (e.g., "OTP Verification")
2. **DLT Template ID** - Required, from DLT portal (e.g., `1607100000000371566`)
3. **Content** - Exact DLT-registered content with `{#var#}` placeholders
4. **Variables** - Define variable mappings:
   - DLT Placeholder: `#var#`
   - System Variable: `otp`
   - Description: "4-digit OTP code"
5. **Category** - Transactional / Promotional
6. **Language** - English, Hindi, etc.

**Features:**
- Character counter (160/1 segment indicator)
- Variable preview with sample values
- Validation for DLT Template ID format

---

### Phase 4: Variable Substitution Logic

Update `send-sms` edge function to handle DLT variable format:

**Current Flow:**
```typescript
// Replaces {{variable}} format
finalMessage = messageContent.replace(/{{variable}}/gi, value);
```

**Updated Flow:**
```typescript
// 1. Fetch template with variable mappings
// 2. For each variable mapping: {dlt_var: "#var#", name: "otp"}
// 3. Replace {#var#} with actual value from templateVariables.otp
finalMessage = content.replace(/{#var#}/g, templateVariables.otp);
```

---

### Phase 5: Pre-populate Your OTP Template

After the table is created, we'll add your OTP template:

| Field | Value |
|-------|-------|
| Name | OTP Verification |
| DLT Template ID | 1607100000000371566 |
| Content | `Your PaisaaSaarthi OTP is {#var#}. Valid for 10 mins` |
| Variables | `[{"dlt_var": "#var#", "name": "otp", "description": "4-digit OTP"}]` |
| Category | transactional |

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/Templates/SMSTemplateDialog.tsx` | Create/Edit SMS template form |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Templates.tsx` | Add SMS tab and template management |
| `supabase/functions/send-sms/index.ts` | Update variable substitution for DLT format |

### Database Migration
- Create `sms_templates` table
- Update `sms_automation_rules.sms_template_id` FK reference
- Enable RLS policies

---

## Variable Format Mapping

| DLT Format | System Variable | Usage |
|------------|-----------------|-------|
| `{#var#}` | `{{otp}}` | OTP code |
| `{#var1#}` | `{{name}}` | Customer name |
| `{#var2#}` | `{{amount}}` | Loan amount |

The template stores the exact DLT content, and the system maps variables during send time.

---

## Implementation Order

1. Create `sms_templates` database table with RLS
2. Add SMS tab to Templates page with list view
3. Create SMSTemplateDialog component
4. Update send-sms function for DLT variable handling
5. Add your OTP template as initial data
6. Test end-to-end with Test SMS button
