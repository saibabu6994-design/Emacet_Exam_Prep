-- TS EXAMprep — Full Database Schema
-- Run in Supabase SQL Editor

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  target_exam TEXT DEFAULT 'EAMCET', -- EAMCET | ECET | POLYCET
  face_descriptor FLOAT8[] NULL,      -- 128-value face-api.js vector
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,          -- Physics | Chemistry | Mathematics
  exam_type TEXT NOT NULL      -- EAMCET | ECET | POLYCET
);

-- Seed default subjects
INSERT INTO subjects (id, name, exam_type) VALUES
  (1, 'Physics', 'EAMCET'),
  (2, 'Chemistry', 'EAMCET'),
  (3, 'Mathematics', 'EAMCET')
ON CONFLICT (id) DO NOTHING;

-- Topics per subject
CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
  subject_id INT REFERENCES subjects(id),
  name TEXT NOT NULL,          -- e.g. "Laws of Motion", "Organic Chemistry"
  difficulty_weight FLOAT DEFAULT 1.0
);

-- Question bank (past papers + AI generated)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id INT REFERENCES subjects(id),
  topic_id INT REFERENCES topics(id),
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer CHAR(1) NOT NULL,   -- A | B | C | D
  explanation TEXT,                   -- step-by-step solution
  shortcut_tip TEXT,                  -- trick or formula shortcut
  source TEXT DEFAULT 'past_paper',  -- past_paper | ai_generated
  year INT,                           -- e.g. 2022 (for past papers)
  difficulty TEXT DEFAULT 'medium',  -- easy | medium | hard | expert
  estimated_solve_time_minutes INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exam sessions
CREATE TABLE IF NOT EXISTS exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  exam_type TEXT NOT NULL,           -- mock | practice | mistake_drill
  subject_ids INT[],
  total_questions INT,
  time_limit_minutes INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INT DEFAULT 0,
  max_score INT,
  status TEXT DEFAULT 'in_progress', -- in_progress | submitted | abandoned
  difficulty TEXT DEFAULT 'medium',  -- easy | medium | hard | expert [NEW]
  source TEXT DEFAULT 'Mixed',       -- Past Papers Only | AI Generated | Mixed [NEW]
  face_checks_passed INT DEFAULT 0,
  tab_switch_warnings INT DEFAULT 0
);

-- Per-question attempt log
CREATE TABLE IF NOT EXISTS question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES exam_sessions(id),
  student_id UUID REFERENCES students(id),
  question_id UUID REFERENCES questions(id),
  selected_answer CHAR(1),           -- A | B | C | D | NULL (skipped)
  is_correct BOOLEAN,
  time_spent_seconds INT,
  is_flagged BOOLEAN DEFAULT FALSE,
  attempt_number INT DEFAULT 1,      -- increments on retry
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, question_id)    -- required for upsert conflict key
);

-- Source documents uploaded by admin
CREATE TABLE IF NOT EXISTS source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,            -- Supabase Storage URL
  doc_type TEXT,                     -- question_paper | answer_key | shortcut_guide
  year INT,
  subject_id INT REFERENCES subjects(id),
  parsed_content TEXT,               -- extracted text for Gemini context
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deduplication tracker (prevents showing same question twice)
CREATE TABLE IF NOT EXISTS seen_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id),
  question_id UUID REFERENCES questions(id) NULL, -- nullable: fallback/AI questions have no DB id
  question_hash TEXT NOT NULL,       -- hash of question text (first 60 chars, normalized)
  seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, question_hash)
);

-- ===========================================================
-- ALTER STATEMENTS (run if tables already exist without new columns)
-- ===========================================================
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
ALTER TABLE exam_sessions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Mixed';
ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE question_attempts ADD CONSTRAINT IF NOT EXISTS question_attempts_session_question_unique UNIQUE (session_id, question_id);
ALTER TABLE seen_questions ALTER COLUMN question_id DROP NOT NULL;

-- ===========================================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seen_questions ENABLE ROW LEVEL SECURITY;

-- Students: read/write own record only
CREATE POLICY IF NOT EXISTS "Students: own data only" ON students
  FOR ALL USING (auth.uid() = id);

-- Exam sessions: own sessions only
CREATE POLICY IF NOT EXISTS "Sessions: own sessions only" ON exam_sessions
  FOR ALL USING (student_id = (SELECT id FROM students WHERE email = auth.email()));

-- Question attempts: own attempts only
CREATE POLICY IF NOT EXISTS "Attempts: own attempts only" ON question_attempts
  FOR ALL USING (student_id = (SELECT id FROM students WHERE email = auth.email()));

-- Seen questions: own tracking only
CREATE POLICY IF NOT EXISTS "Seen: own tracking only" ON seen_questions
  FOR ALL USING (student_id = (SELECT id FROM students WHERE email = auth.email()));

-- Questions: readable by all authenticated users, writable by service role only
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Questions: read-only for authenticated" ON questions
  FOR SELECT USING (auth.role() IN ('authenticated', 'service_role'));
