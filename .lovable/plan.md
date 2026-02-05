
# SMS Implementation Plan

## Overview
Implement transactional SMS functionality with automated triggers, integrated into the Communications hub alongside WhatsApp and Calling. The system will use your existing Exotel integration and be fully DLT compliant.

---

## Architecture Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SMS SYSTEM ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGERS                    PROCESSING                    DELIVERY        │
│  ────────                    ──────────                    ────────        │
│                                                                             │
│  ┌─────────────┐            ┌─────────────────┐           ┌─────────────┐  │
│  │ Loan Status │────────────│ automation-     │──────────▶│ send-sms    │  │
│  │ Change      │            │ trigger-handler │           │ edge fn     │  │
│  └─────────────┘            └─────────────────┘           └─────────────┘  │
│                                    │                            │          │
│  ┌─────────────┐                   │                            │          │
│  │ eMandate    │───────────────────┤                            ▼          │
│  │ Events      │                   │                      ┌───────────┐    │
│  └─────────────┘                   │                      │  Exotel   │    │
│                                    │                      │  SMS API  │    │
│  ┌─────────────┐                   ▼                      └───────────┘    │
│  │ eSign       │            ┌─────────────────┐                 │          │
│  │ Events      │────────────│ sms_automation_ │                 │          │
│  └─────────────┘            │ executions      │                 │          │
│                             └─────────────────┘                 ▼          │
│                                                           ┌───────────┐    │
│                                                           │ sms_      │    │
│                                                           │ messages  │    │
│                                                           └───────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema

### 1.1 SMS Messages Table
Log all SMS communications for tracking and analytics:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization (FK) |
| contact_id | uuid | Recipient contact (FK) |
| loan_application_id | uuid | Associated loan (optional) |
| phone_number | text | Destination number |
| message_content | text | SMS body (max 160 chars recommended) |
| template_id | uuid | Link to communication_templates |
| template_variables | jsonb | Variable substitutions |
| dlt_template_id | text | DLT registered template ID |
| exotel_sid | text | Exotel message SID for tracking |
| status | text | pending/sent/delivered/failed |
| error_message | text | Failure reason if any |
| sent_at | timestamptz | Dispatch timestamp |
| delivered_at | timestamptz | Delivery confirmation timestamp |
| sent_by | uuid | User who triggered (for manual sends) |
| trigger_type | text | manual/automation/system |
| created_at | timestamptz | Record creation |

### 1.2 SMS Automation Rules Table
Configure automated SMS triggers:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization |
| name | text | Rule name |
| description | text | Rule description |
| is_active | boolean | Enable/disable toggle |
| trigger_type | text | stage_change, disposition_set, emandate_status, esign_status |
| trigger_config | jsonb | Trigger-specific configuration |
| condition_logic | text | AND/OR for conditions |
| conditions | jsonb | Additional conditions to check |
| sms_template_id | uuid | Template to send |
| send_delay_minutes | integer | Delay before sending |
| max_sends_per_contact | integer | Limit per contact |
| cooldown_period_days | integer | Wait between sends |
| priority | integer | Rule priority |
| total_triggered | integer | Stats counter |
| total_sent | integer | Stats counter |
| total_failed | integer | Stats counter |
| created_by | uuid | Creator |
| created_at | timestamptz | Creation time |

### 1.3 SMS Automation Executions Table
Track each automation run:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| org_id | uuid | Organization |
| rule_id | uuid | Which rule triggered |
| contact_id | uuid | Target contact |
| loan_application_id | uuid | Associated loan |
| trigger_type | text | What triggered this |
| trigger_data | jsonb | Trigger context |
| status | text | pending/sent/failed/skipped |
| sms_message_id | uuid | Link to sms_messages |
| scheduled_for | timestamptz | When to send |
| sent_at | timestamptz | When sent |
| error_message | text | Failure reason |
| created_at | timestamptz | Record creation |

### 1.4 Exotel Settings Update
Add DLT compliance fields:

| Column | Type | Description |
|--------|------|-------------|
| sms_sender_id | text | DLT-approved Sender ID (Header) |
| dlt_entity_id | text | Principal Entity ID from DLT portal |

---

## Phase 2: Backend Edge Functions

### 2.1 send-sms Edge Function
Core SMS sending function using Exotel API:

```typescript
// supabase/functions/send-sms/index.ts
// Key features:
// - DLT compliance (Entity ID, Template ID in request)
// - Exotel SMS API: POST /v1/Accounts/{sid}/Sms/send.json
// - Content-Type: application/x-www-form-urlencoded
// - Template variable substitution
// - Status logging to sms_messages table
```

**Exotel SMS API Format:**
```
POST https://{subdomain}/v1/Accounts/{account_sid}/Sms/send.json
Authorization: Basic {base64(api_key:api_token)}
Content-Type: application/x-www-form-urlencoded

From={sender_id}&To={phone}&Body={message}&DltEntityId={entity_id}&DltTemplateId={template_id}
```

### 2.2 sms-automation-trigger Integration
Extend existing `automation-trigger-handler` to support SMS rules:

- Query both `email_automation_rules` and `sms_automation_rules` for matching triggers
- Process SMS rules through the same condition evaluation logic
- Create executions in `sms_automation_executions`
- Call `send-sms` function for delivery

### 2.3 sms-webhook Edge Function
Handle Exotel delivery receipts (DLR):

- Receive status updates from Exotel
- Update `sms_messages.status` (delivered/failed)
- Update `sms_messages.delivered_at` timestamp

---

## Phase 3: Frontend Components

### 3.1 Communications Hub - SMS Tab
Add SMS tab to `src/pages/Communications.tsx`:

```
Communications
├── Conversations (WhatsApp, Email)
├── Email Campaigns
├── Calling
└── SMS (NEW)
    ├── SMS Dashboard (stats + recent messages)
    ├── SMS Automation Rules
    └── SMS Settings link
```

### 3.2 SMS Dashboard Component
New component: `src/components/SMS/SMSDashboard.tsx`

Features:
- Statistics cards (Total, Sent, Delivered, Failed)
- Recent SMS messages table with search
- Export to CSV
- Auto-refresh with realtime updates

### 3.3 SMS Automation Rules Page
New page: `src/pages/SMSAutomationRules.tsx`

Features:
- List all SMS automation rules
- Create/edit rule wizard:
  1. Select trigger type (Stage Change, eMandate Status, eSign Status)
  2. Configure trigger conditions
  3. Select SMS template
  4. Set delays and limits
- Enable/disable toggle
- Test rule functionality
- View execution history

### 3.4 SMS Templates in Templates Page
Update `src/pages/Templates.tsx`:

- Add SMS tab alongside WhatsApp and Email
- SMS template form with:
  - Template name
  - DLT Template ID (required for compliance)
  - Content (160 char limit indicator)
  - Variables ({{name}}, {{loan_id}}, etc.)
  - Category (transactional/promotional)

### 3.5 Exotel Settings Update
Update `src/pages/ExotelSettings.tsx`:

Add SMS Configuration section:
- SMS Sender ID (DLT Header)
- DLT Entity ID (Principal Entity ID)
- Test SMS button

---

## Phase 4: Automation Triggers

### 4.1 Supported Trigger Types
The following events will trigger SMS automations:

| Trigger | Description | Example Use Case |
|---------|-------------|------------------|
| stage_change | Loan moves to new stage | "Your loan is now under review" |
| disposition_set | Call outcome recorded | "We tried reaching you..." |
| emandate_status | eMandate status change | "Your mandate is now active" |
| esign_status | eSign document status | "Document signed successfully" |
| payment_due | Payment reminder | "EMI of Rs.X due on..." |
| loan_approved | Loan approved | "Congratulations! Loan approved" |
| loan_disbursed | Loan disbursed | "Rs.X credited to your account" |

### 4.2 Database Trigger Integration
Add SMS trigger support to existing PostgreSQL triggers:

- `trigger_stage_change_automation()` - Already exists, will extend
- `trigger_emandate_status_change()` - New trigger on `loan_emandate_requests`
- `trigger_esign_status_change()` - New trigger on `loan_esign_requests`

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/send-sms/index.ts` | Core SMS sending function |
| `supabase/functions/sms-webhook/index.ts` | Delivery receipt handler |
| `src/components/SMS/SMSDashboard.tsx` | SMS dashboard component |
| `src/components/SMS/SMSAutomationRuleForm.tsx` | Rule creation wizard |
| `src/pages/SMSAutomationRules.tsx` | Automation rules management |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/config.toml` | Add send-sms and sms-webhook config |
| `supabase/functions/automation-trigger-handler/index.ts` | Add SMS rule processing |
| `src/pages/Communications.tsx` | Add SMS tab |
| `src/pages/Templates.tsx` | Add SMS templates tab |
| `src/pages/ExotelSettings.tsx` | Add DLT configuration fields |

### Database Migrations
| Migration | Purpose |
|-----------|---------|
| Create `sms_messages` table | Message logging |
| Create `sms_automation_rules` table | Automation config |
| Create `sms_automation_executions` table | Execution tracking |
| Alter `exotel_settings` | Add DLT fields |
| Create SMS-related triggers | Event-driven automations |

---

## DLT Compliance Requirements

For each SMS sent, the following will be included:

1. **Principal Entity ID** - Your business ID on DLT portal (stored in `exotel_settings.dlt_entity_id`)
2. **DLT Template ID** - Each template's registered ID (stored in `communication_templates.template_id`)
3. **Sender ID (Header)** - Approved sender name (stored in `exotel_settings.sms_sender_id`)

These fields are mandatory for transactional SMS in India and will be passed to Exotel's API.

---

## Implementation Order

1. **Database schema** - Create tables and add DLT fields
2. **send-sms edge function** - Core sending logic with DLT support
3. **SMS Dashboard** - View and track messages
4. **Templates UI update** - Add SMS tab for template management
5. **Exotel Settings update** - DLT configuration UI
6. **Automation rules** - Create sms_automation_rules infrastructure
7. **Trigger integration** - Extend automation-trigger-handler
8. **Webhook handler** - Delivery status updates
9. **Testing** - End-to-end verification

---

## Configuration You'll Need to Provide

Before going live, you'll need to enter these in the Exotel Settings page:

1. **DLT Entity ID** - Your Principal Entity ID from TRAI DLT portal
2. **SMS Sender ID** - Your approved 6-character Header (e.g., "PAISAA")
3. **DLT Template IDs** - For each SMS template you create

These will be stored securely in your database and included in every SMS API call.
