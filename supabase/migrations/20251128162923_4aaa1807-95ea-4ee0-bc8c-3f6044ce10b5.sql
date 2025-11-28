-- Clean up integration-related tables if they exist
-- This migration removes tables related to removed integrations

-- Drop contact enrichment logs table (Apollo integration)
DROP TABLE IF EXISTS contact_enrichment_logs CASCADE;

-- Note: google_oauth_tokens table was already dropped in a previous migration
-- Note: payment-related tables (payment_transactions, wallet_transactions) are kept 
-- as they may be used for future payment integrations