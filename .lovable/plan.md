

# Add Login Button to Marketing Header

## What Changes

### MarketingHeader.tsx
- Add a **"Login"** link/button in the desktop nav area, positioned between the nav links and the phone number (matching the reference screenshot)
- The Login button navigates to `/login`
- Style it to match the reference: appears as a distinct clickable element in the header bar
- Also add Login link in the mobile menu

The homepage at `/` is already the landing page -- no route changes needed. This is purely a header update to add the missing Login navigation.

## Technical Details

**File to modify:** `src/components/Marketing/MarketingHeader.tsx`

- Add a `<Link to="/login">` styled as a button or nav link in the desktop right-side area (before the phone number)
- Add the same Login link in the mobile dropdown menu
- Match the visual style from the reference: the login button appears as a text link or outlined element in the nav bar

