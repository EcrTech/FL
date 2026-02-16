

# Public Marketing Website for Paisa Saarthi

## Overview
Add a full public-facing marketing website with its own layout (Header, Footer), completely separate from the existing LOS dashboard. The existing login page at `/` will move to `/login`, freeing `/` for the marketing homepage.

## Route Changes

| Route | Page | Type |
|-------|------|------|
| `/` | Home (marketing) | NEW |
| `/about` | About Us | NEW |
| `/services` | Services | NEW |
| `/contact` | Contact Us | NEW |
| `/faq` | FAQ | NEW |
| `/how-to-apply` | How to Apply | NEW |
| `/apply` | Apply (redirects to referral flow or general form) | NEW |
| `/privacy` | Privacy Policy | NEW |
| `/terms` | Terms & Conditions | NEW |
| `/login` | Login (moved from `/`) | MOVED |

The catch-all `*` route will redirect to `/` (the new homepage instead of login).

## New Files to Create

### Layout Components (`src/components/Marketing/`)
- **MarketingLayout.tsx** -- Wrapper with Header + Footer + floating buttons
- **MarketingHeader.tsx** -- Branded navbar with logo, nav links (Home, About, Services, How to Apply, Contact), and a "Login" CTA button. Responsive with mobile hamburger menu.
- **MarketingFooter.tsx** -- Footer with company info, quick links, contact details, social links
- **FloatingButtons.tsx** -- Fixed-position WhatsApp and Call buttons (bottom-right corner)

### Page Components (`src/pages/Marketing/`)
- **Home.tsx** -- Hero section with CTA, key features/services overview, trust indicators, testimonials placeholder
- **About.tsx** -- Company mission, vision, team info
- **Services.tsx** -- Loan products offered (personal loans, business loans, etc.)
- **Contact.tsx** -- Contact form, office address, map placeholder, phone/email
- **FAQ.tsx** -- Accordion-based frequently asked questions
- **HowToApply.tsx** -- Step-by-step application process guide
- **Apply.tsx** -- General apply page with options or redirect to referral flow
- **Privacy.tsx** -- Privacy policy content
- **Terms.tsx** -- Terms and conditions content

## Technical Details

### App.tsx Changes
- Move the Login route from `/` to `/login`
- Add all new marketing routes wrapping pages in `MarketingLayout`
- Update the catch-all redirect from `/` (login) to `/` (homepage)

### MarketingLayout Structure
```text
+---------------------------+
| MarketingHeader           |
|  Logo | Nav Links | Login |
+---------------------------+
|                           |
|  {children} (page content)|
|                           |
+---------------------------+
| MarketingFooter           |
|  Links | Contact | Social |
+---------------------------+
| [WhatsApp] [Call] floating|
+---------------------------+
```

### Styling Approach
- Reuse the existing Paisa Saarthi teal color scheme (CSS variables already defined)
- Use existing UI components (Button, Card, Accordion) for consistency
- Responsive/mobile-first design using Tailwind
- The marketing pages will use the `paisaa-saarthi-logo.jpeg` from assets

### Floating Buttons
- WhatsApp: Links to `https://wa.me/<number>` (configurable)
- Call: Links to `tel:<number>` (configurable)
- Fixed position bottom-right, always visible on marketing pages only
- Animated with subtle pulse/bounce effect

### No Database Changes Required
All marketing pages are static content -- no new tables or backend functions needed.

