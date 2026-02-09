
## Access Management (View Controller) Page

### What This Does
A new admin-only page where you can control which menu items and features each designation (e.g., Business Manager, Credit Manager, Project Manager) can see and access. This uses the existing `designation_feature_access` and `feature_permissions` tables that are already in your database but currently empty.

### How It Works
1. Select a designation from a dropdown
2. See a matrix/grid of all features (menu items) with toggle switches for View, Create, Edit, Delete permissions
3. Save changes -- they take effect immediately for all users with that designation

### Features Covered
All sidebar menu items will be controllable:
- LOS Dashboard, Leads, Loan Applications, Approvals, Sanctions, Disbursals, Collections, Reports
- Tasks, Communications, Upload Leads, Data Repository, Inventory
- Users, Teams, Designations
- Webhook Connectors, Outbound Webhooks, eMandate Settings, Negative Pin Codes, Exotel Settings

### Technical Details

**Step 1: Seed `feature_permissions` table**
Run a database migration to insert all feature keys into the `feature_permissions` table so the UI has a master list of features to display. Categories will group them (e.g., "LOS", "Sales & Operations", "Management", "Integration").

Features to seed:
| Feature Key | Display Name | Category |
|---|---|---|
| los_dashboard | LOS Dashboard | LOS |
| pipeline_stages | Leads | Sales & Operations |
| loan_applications | Loan Applications | LOS |
| approvals | Approvals | LOS |
| sanctions | Sanctions | LOS |
| disbursals | Disbursals | LOS |
| collections | Collections | LOS |
| los_reports | Reports | LOS |
| tasks | Tasks | Operations |
| communications | Communications | Operations |
| calling | Upload Leads | Operations |
| redefine_data_repository | Data Repository | Operations |
| inventory | Inventory | Operations |
| users | Users | Management |
| teams | Teams | Management |
| designations | Designations | Management |
| connectors | Webhooks & Connectors | Integration |
| emandate_settings | eMandate Settings | Integration |
| negative_pincodes | Negative Pin Codes | Integration |
| exotel_settings | Exotel Settings | Integration |

**Step 2: Create `AccessManagement` page** (`src/pages/AccessManagement.tsx`)
- Admin-only page
- Dropdown to select a designation
- Grid showing all features grouped by category
- Toggle switches (checkboxes) for can_view, can_create, can_edit, can_delete per feature
- Save button that upserts into `designation_feature_access`
- Uses existing `useOrgData` hook pattern

**Step 3: Add route in `App.tsx`**
- Route: `/admin/access-management`
- Protected with `requiredRole="admin"`

**Step 4: Add sidebar link in `DashboardLayout.tsx`**
- Add "Access Management" link under the Management section (visible to admins only)
- Icon: `Shield` from lucide-react

**Step 5: Update `DashboardLayout.tsx` sidebar guards**
- Wrap currently unguarded menu items (LOS Dashboard, Loan Applications, Approvals, Sanctions, Disbursals, Collections, Reports, Tasks, eMandate Settings, Negative Pin Codes, Exotel Settings) with `canAccessFeature()` checks using matching feature keys
- This ensures the access management settings actually hide/show menu items

**Step 6: Update `canAccessFeature` logic**
- Currently returns `true` if no permission entry exists (default allow)
- This behavior is correct -- admins only need to add restrictions, not enable everything
- No change needed to AuthContext logic
