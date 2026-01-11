-- Reset stuck jobs for testing
-- Run this in Neon console to clear stuck 'processing' status

-- Reset blob_inventory status from 'processing' back to 'pending'
UPDATE blob_inventory 
SET status = 'pending' 
WHERE status = 'processing';

-- Delete any queued/running jobs that never completed
DELETE FROM extraction_jobs 
WHERE status IN ('queued', 'running');

-- Show current state
SELECT status, COUNT(*) FROM blob_inventory GROUP BY status;
SELECT status, COUNT(*) FROM extraction_jobs GROUP BY status;
