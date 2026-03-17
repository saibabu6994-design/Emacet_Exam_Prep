-- ============================================================
-- Cleanup: Delete old in_progress sessions, keep only the latest
-- Run in Supabase SQL Editor
-- ============================================================

-- Delete all in_progress sessions except the most recent one per student
DELETE FROM exam_sessions
WHERE status = 'in_progress'
  AND id NOT IN (
    SELECT DISTINCT ON (student_id) id
    FROM exam_sessions
    WHERE status = 'in_progress'
    ORDER BY student_id, started_at DESC
  );

-- Verify what remains
SELECT id, student_id, exam_type, status, started_at
FROM exam_sessions
ORDER BY started_at DESC;
