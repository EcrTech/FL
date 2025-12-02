-- Make phone NOT NULL and UNIQUE on contacts table
-- First, update any NULL phone values to a placeholder (will need manual update)
UPDATE public.contacts SET phone = 'NEEDS_UPDATE_' || id WHERE phone IS NULL;

-- Add NOT NULL constraint to phone
ALTER TABLE public.contacts ALTER COLUMN phone SET NOT NULL;

-- Add UNIQUE constraint to phone within org (contacts might have same phone across orgs)
-- Using a unique index on org_id + phone combination
CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_phone_unique ON public.contacts(org_id, phone);

-- first_name is already NOT NULL, no change needed there
-- Remove any other unnecessary constraints if they exist (email uniqueness, etc.)
DROP INDEX IF EXISTS contacts_email_key;
DROP INDEX IF EXISTS contacts_org_email_unique;