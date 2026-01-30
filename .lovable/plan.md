
# Call Integration and Case History for Loan Application Detail Page

## Overview
This plan implements a calling feature using the existing Exotel infrastructure and adds a comprehensive case history page that consolidates all contact interactions (calls, emails, WhatsApp messages) for a loan application.

---

## Current Infrastructure Analysis

**What's Already Configured:**
- Exotel Edge Functions: `exotel-make-call`, `exotel-webhook`, `exotel-get-recording`
- `call_logs` table with recording support
- `CallRecordingPlayer` component for playback
- `ClickToCall` component with disposition tracking
- `exotel_settings` table (needs org configuration)
- User profile has `calling_enabled` and `phone` fields

**What's Missing:**
- Call icon on the loan application detail page
- Linking call logs to loan applications (`loan_application_id` column needs to be added to `call_logs`)
- Case history page consolidating all communications

---

## Implementation Plan

### Phase 1: Database Schema Update
Add `loan_application_id` column to `call_logs` table to track calls associated with loan applications.

```text
+-------------+            +---------------+
| call_logs   |            | loan_applications |
+-------------+            +---------------+
| id          |<-----------| id            |
| ...         |  (new FK)  | ...           |
| loan_application_id (new)|               |
+-------------+            +---------------+
```

**SQL Migration:**
- Add `loan_application_id` (UUID, nullable, foreign key) to `call_logs`
- Update RLS policies for proper access control

---

### Phase 2: Call Button on Applicant Profile Card

**Location:** `src/components/LOS/ApplicantProfileCard.tsx`

Add a third communication button (phone icon) alongside the existing WhatsApp and Email buttons.

**Component Changes:**
1. Import `Phone` icon from lucide-react
2. Create a new `CallChatDialog` component (similar to WhatsApp/Email dialogs)
3. Add Phone button with green styling matching the WhatsApp button
4. On click, opens call dialog showing:
   - Active call status with real-time updates
   - Call history for this applicant
   - Disposition form after call ends

**Call Flow:**
```text
User clicks Phone icon
        |
        v
+-------------------+
| CallChatDialog    |
| - Check user has  |
|   phone in profile|
| - Check Exotel    |
|   configured      |
+-------------------+
        |
        v
Invoke exotel-make-call (with loan_application_id)
        |
        v
Real-time status updates via agent_call_sessions
        |
        v
Call ends -> Disposition form
        |
        v
Save disposition to call_logs
```

---

### Phase 3: New Edge Function Update

**Modify:** `supabase/functions/exotel-make-call/index.ts`

Add support for `loanApplicationId` parameter:
- Accept optional `loanApplicationId` in request body
- Include in call_logs insert when creating the call record
- This links the call to the specific loan application

---

### Phase 4: Call Chat Dialog Component

**Create:** `src/components/LOS/Relationships/CallChatDialog.tsx`

Features:
1. **Header:** Applicant name, phone number, call status badge
2. **Call History Section:**
   - List of previous calls for this phone number / loan application
   - Each call shows: date/time, duration, status, disposition
   - Call recording player for completed calls with recordings
3. **Active Call Panel:**
   - Real-time status (initiating, ringing, connected)
   - Duration timer
   - End call button
4. **Make Call Button:**
   - Only enabled if Exotel is configured
   - Only enabled if user has phone number in profile
   - Shows loading state during call initiation
5. **Disposition Form:**
   - Appears after call ends
   - Disposition and sub-disposition dropdowns
   - Notes textarea
   - Callback date/time picker for follow-ups
   - Save button

---

### Phase 5: Case History Page

**Create:** `src/components/LOS/CaseHistoryDialog.tsx`

A comprehensive timeline view consolidating:

1. **Call History:**
   - Fetched from `call_logs` where `loan_application_id` matches OR `to_number`/`from_number` matches applicant mobile
   - Shows: date, time, duration, status, agent, disposition, recording

2. **Email History:**
   - Fetched from `email_conversations` where `to_email` OR `from_email` matches applicant email
   - Shows: date, subject, status (sent/delivered/opened), direction

3. **WhatsApp History:**
   - Fetched from `whatsapp_messages` where `phone_number` matches applicant mobile
   - Shows: date, message preview, status, direction

4. **Stage History:**
   - Already exists in `loan_stage_history`
   - Shows: stage transitions with who moved it and when

5. **Activity Notes:**
   - From `contact_activities` linked to calls
   - Any manual notes added

**UI Design:**
- Tabbed interface: All | Calls | Emails | WhatsApp | Notes
- Timeline view with color-coded entries
- Filter by date range
- Export option

**Access from Application Detail:**
- Add "Case History" button in the header area
- Opens the dialog overlay

---

### Phase 6: Application Detail Page Updates

**Modify:** `src/pages/LOS/ApplicationDetail.tsx`

1. Add "Case History" button in the header section
2. Import and render `CaseHistoryDialog`
3. Pass applicationId and applicant details

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `call_logs` table | Migrate | Add `loan_application_id` column |
| `supabase/functions/exotel-make-call/index.ts` | Modify | Accept `loanApplicationId` parameter |
| `src/components/LOS/ApplicantProfileCard.tsx` | Modify | Add Phone call button |
| `src/components/LOS/Relationships/CallChatDialog.tsx` | Create | Call dialog with history and dialer |
| `src/components/LOS/CaseHistoryDialog.tsx` | Create | Comprehensive communication timeline |
| `src/pages/LOS/ApplicationDetail.tsx` | Modify | Add Case History button |

---

## Technical Details

### Call Recording Access
The existing `exotel-get-recording` edge function:
- Authenticates user
- Verifies org access
- Fetches recording from Exotel using stored credentials
- Returns audio stream

### Real-time Updates
Subscribe to `agent_call_sessions` table for live call status:
- `initiating` - Call being placed
- `ringing` - Recipient phone ringing
- `connected` - Call in progress
- `ended` - Call completed

### User Requirements
For calling to work, users need:
1. `calling_enabled = true` on their profile
2. `phone` field set in their profile
3. Organization has Exotel configured and active

---

## UX Flow

```text
Loan Application Detail Page
         |
         +-- Applicant Profile Card
         |        |
         |        +-- [WhatsApp] [Email] [Phone] buttons
         |        |
         |        +-- Click Phone -> CallChatDialog
         |             |
         |             +-- View call history
         |             +-- Make new call
         |             +-- Listen to recordings
         |             +-- Add dispositions
         |
         +-- [Case History] button in header
                  |
                  +-- CaseHistoryDialog
                       |
                       +-- Timeline of all interactions
                       +-- Calls with recordings
                       +-- Emails with open tracking
                       +-- WhatsApp messages
                       +-- Stage changes
```

---

## Dependencies
- Exotel settings must be configured by the organization
- User must have calling enabled on their profile
- User must have their phone number saved in profile
