

## Rebuild Leads Page as CRM Table + Lead Detail Page

The current `/calling/upload-leads` page is still using the old spread-out card layout with separate sections for manual entry, CSV upload, and preview. It needs to be completely rebuilt into a compact CRM-style interface (like the reference screenshots), plus a new Lead Detail page.

---

### Page 1: Leads Table (`/calling/upload-leads`)

**Layout (matching the Pipeline Board reference):**
- **Header**: "Leads" title with two action buttons top-right: "+ Add Lead" and "Upload CSV"
- **"+ Add Lead"** opens a compact dialog/modal with Name + Phone fields
- **"Upload CSV"** triggers a file picker (same CSV parsing logic)
- **Search bar** below header to filter leads by name or phone
- **CRM Table** showing all `calling_upload` leads from the database (not just session-uploaded ones), with columns:
  - Name
  - Phone
  - Source
  - Created (date)
  - Actions: Call icon (tel: link), WhatsApp icon (opens WhatsAppChatDialog), View button (navigates to detail page)
- Data fetched via `useQuery` from `contacts` table filtered by `source = 'calling_upload'` and current org

**Key changes from current:**
- Remove the 3 separate Card sections (manual entry, CSV upload, preview)
- Fetch existing leads from DB on page load instead of only showing session-uploaded leads
- Compact inline action buttons per row

---

### Page 2: Lead Detail (`/calling/leads/:id` - new file)

**Layout (matching the Lead Detail reference):**
- **Back button** + Lead name as page title
- **Left sidebar card**: Contact Information
  - Phone, email (if any), company, city, source, created date, assigned to
- **Right content area**: "Activities & Notes" with tabs
  - **Journey tab**: Chronological timeline aggregating `call_logs`, `whatsapp_messages`, and `email_conversations` for this contact
  - **Notes tab**: Display and add notes (from `contacts.notes` field)
- **Action buttons** in header: Call, WhatsApp icons

---

### Technical Details

**Files to modify:**
1. **`src/pages/CallingUploadLeads.tsx`** - Complete rewrite into CRM table view
   - Use `useQuery` to fetch contacts where `source = 'calling_upload'` and `org_id` matches
   - Add Lead dialog using existing Dialog component
   - Search filter (client-side on name/phone)
   - Row actions: Call (tel: link), WhatsApp (WhatsAppChatDialog), View (navigate to detail)

2. **`src/pages/CallingLeadDetail.tsx`** - New file
   - Fetch single contact by ID
   - Left panel: contact info card
   - Right panel: tabbed timeline (Journey, Notes)
   - Journey aggregates from `call_logs`, `whatsapp_messages`, `email_conversations` joined on `contact_id`
   - Notes section with ability to update `contacts.notes`

3. **`src/App.tsx`** - Add route `/calling/leads/:id` for the detail page

**No database changes needed** - all data already exists in the `contacts`, `call_logs`, `whatsapp_messages`, and `email_conversations` tables.

