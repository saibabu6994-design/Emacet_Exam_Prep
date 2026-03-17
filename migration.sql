-- ============================================================
-- TS EXAMprep — COMPLETE SAFE SCHEMA + MIGRATION
-- Run this in Supabase SQL Editor (safe to run multiple times)
-- ============================================================

-- -------------------------------------------------------
-- STEP 1: Create tables (all use IF NOT EXISTS — safe to re-run)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  target_exam TEXT DEFAULT 'EAMCET',
  face_descriptor FLOAT8[] NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  exam_type TEXT NOT NULL
);

INSERT INTO subjects (id, name, exam_type) VALUES
  (1, 'Physics', 'EAMCET'),
  (2, 'Chemistry', 'EAMCET'),
  (3, 'Mathematics', 'EAMCET')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  subject_id INT REFERENCES subjects(id),
  name TEXT NOT NULL,
  difficulty_weight FLOAT DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id INT REFERENCES subjects(id),
  topic_id INT REFERENCES topics(id),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,
  explanation TEXT,
  shortcut_tip TEXT,
  source TEXT DEFAULT 'past_paper',
  year INT,
  difficulty TEXT DEFAULT 'medium',
  estimated_solve_time_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  exam_type TEXT NOT NULL,
  subject_ids INT[],
  total_questions INT,
  time_limit_minutes INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INT DEFAULT 0,
  max_score INT,
  status TEXT DEFAULT 'in_progress',
  difficulty TEXT DEFAULT 'medium',
  source TEXT DEFAULT 'Mixed',
  face_checks_passed INT DEFAULT 0,
  tab_switch_warnings INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id),
  student_id UUID REFERENCES students(id),
  question_id UUID REFERENCES questions(id),
  selected_answer CHAR(1),
  is_correct BOOLEAN,
  time_spent_seconds INT,
  is_flagged BOOLEAN DEFAULT FALSE,
  attempt_number INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  doc_type TEXT,
  year INT,
  subject_id INT REFERENCES subjects(id),
  parsed_content TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seen_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  question_id UUID REFERENCES questions(id) NULL,
  question_hash TEXT NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- STEP 2: ADD missing columns (safe — uses IF NOT EXISTS)
-- -------------------------------------------------------
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Mixed';
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS tab_switch_warnings INT DEFAULT 0;
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS face_checks_passed INT DEFAULT 0;

ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;

-- -------------------------------------------------------
-- STEP 3: Add UNIQUE constraints (safe with DO block)
-- -------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'question_attempts_session_question_unique'
  ) THEN
    ALTER TABLE question_attempts
      ADD CONSTRAINT question_attempts_session_question_unique
      UNIQUE (session_id, question_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seen_questions_student_id_question_hash_key'
  ) THEN
    ALTER TABLE seen_questions
      ADD CONSTRAINT seen_questions_student_id_question_hash_key
      UNIQUE (student_id, question_hash);
  END IF;
END$$;

-- -------------------------------------------------------
-- STEP 4: Enable RLS on all tables
-- -------------------------------------------------------
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- STEP 5: Drop old (broken) policies and recreate correctly
-- auth.uid() = students.id  (NOT auth.email() lookup)
-- -------------------------------------------------------

-- students
DROP POLICY IF EXISTS "Students: own data only" ON students;
CREATE POLICY "Students: own data only" ON students
  FOR ALL USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- exam_sessions
DROP POLICY IF EXISTS "Sessions: own sessions only" ON exam_sessions;
CREATE POLICY "Sessions: own sessions only" ON exam_sessions
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- question_attempts
DROP POLICY IF EXISTS "Attempts: own attempts only" ON question_attempts;
CREATE POLICY "Attempts: own attempts only" ON question_attempts
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- seen_questions
DROP POLICY IF EXISTS "Seen: own tracking only" ON seen_questions;
CREATE POLICY "Seen: own tracking only" ON seen_questions
  FOR ALL USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- questions: all authenticated can read
DROP POLICY IF EXISTS "Questions: read-only for authenticated" ON questions;
CREATE POLICY "Questions: read-only for authenticated" ON questions
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Questions: insert by service role" ON questions;
CREATE POLICY "Questions: insert by service role" ON questions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- source_documents
DROP POLICY IF EXISTS "Docs: read by authenticated" ON source_documents;
CREATE POLICY "Docs: read by authenticated" ON source_documents
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Docs: insert by service role" ON source_documents;
CREATE POLICY "Docs: insert by service role" ON source_documents
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- subjects: all authenticated can read
DROP POLICY IF EXISTS "Subjects: read all" ON subjects;
CREATE POLICY "Subjects: read all" ON subjects
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- topics: all authenticated can read
DROP POLICY IF EXISTS "Topics: read all" ON topics;
CREATE POLICY "Topics: read all" ON topics
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));

-- -------------------------------------------------------
-- STEP 6: Reload Supabase schema cache
-- -------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Done! All tables, columns, constraints, and policies applied.
-- ============================================================
