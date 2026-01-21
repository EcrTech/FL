-- Update the default interest rate from 0.5% to 1%
ALTER TABLE loan_applications 
ALTER COLUMN interest_rate SET DEFAULT 1;

-- Update existing records that have 0.5% interest rate
UPDATE loan_applications 
SET interest_rate = 1 
WHERE interest_rate = 0.5;