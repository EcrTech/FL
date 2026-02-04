-- Add parsing progress tracking columns to loan_documents table
ALTER TABLE loan_documents 
ADD COLUMN IF NOT EXISTS parsing_status TEXT DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS parsing_progress JSONB DEFAULT '{"current_page": 0, "total_pages": 0, "chunks_completed": 0}',
ADD COLUMN IF NOT EXISTS parsing_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS parsing_completed_at TIMESTAMPTZ;

-- Add constraint for parsing_status (using validation trigger instead of CHECK for flexibility)
CREATE OR REPLACE FUNCTION public.validate_parsing_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parsing_status NOT IN ('idle', 'processing', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid parsing_status: %. Must be one of: idle, processing, completed, failed', NEW.parsing_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_loan_documents_parsing_status ON loan_documents;
CREATE TRIGGER validate_loan_documents_parsing_status
BEFORE INSERT OR UPDATE OF parsing_status ON loan_documents
FOR EACH ROW
EXECUTE FUNCTION public.validate_parsing_status();

-- Index for querying in-progress parsing jobs
CREATE INDEX IF NOT EXISTS idx_loan_documents_parsing_status 
ON loan_documents(parsing_status) 
WHERE parsing_status = 'processing';