export interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer?: string; // Hidden from student during exam, revealed post-submit
  explanation?: string;
  shortcut_tip?: string;
  subject_id: number;
  topic_id?: number;
  difficulty?: string;
  year?: number;
  source?: string;
  estimated_solve_time_minutes?: number;
}

export interface Student {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  target_exam?: string;
  face_descriptor?: number[];
  created_at?: string;
  last_login?: string;
}

export interface ExamSession {
  id: string;
  student_id: string;
  exam_type: string;
  subject_ids?: number[];
  total_questions: number;
  time_limit_minutes: number;
  started_at?: string;
  submitted_at?: string;
  score?: number;
  max_score?: number;
  status: string;
  difficulty?: string;
  source?: string;
}

export interface QuestionAttempt {
  id?: string;
  session_id: string;
  student_id: string;
  question_id: string;
  selected_answer?: string | null;
  is_correct?: boolean | null;
  time_spent_seconds?: number;
  is_flagged?: boolean;
  attempt_number?: number;
}

export const SUBJECT_NAMES: Record<number, string> = {
  1: 'Physics',
  2: 'Chemistry',
  3: 'Mathematics',
};

export const SUBJECT_COLORS: Record<number, string> = {
  1: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  2: 'bg-amber-100 text-amber-700 border-amber-200',
  3: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// Topic names indexed by [subject_id][topic_id] (1-indexed)
export const TOPIC_NAMES: Record<number, Record<number, string>> = {
  1: { // Physics
    1: 'Laws of Motion',
    2: 'Work, Energy & Power',
    3: 'Gravitation',
    4: 'Waves & Optics',
    5: 'Electrostatics',
    6: 'Current Electricity',
    7: 'Magnetism',
    8: 'Modern Physics',
  },
  2: { // Chemistry
    1: 'Atomic Structure',
    2: 'Chemical Bonding',
    3: 'Organic Chemistry',
    4: 'Thermodynamics',
    5: 'Equilibrium',
    6: 'Electrochemistry',
    7: 'Coordination Compounds',
    8: 'p-Block Elements',
  },
  3: { // Mathematics
    1: 'Algebra',
    2: 'Calculus',
    3: 'Coordinate Geometry',
    4: 'Trigonometry',
    5: 'Probability & Statistics',
    6: 'Vectors & 3D',
    7: 'Differential Equations',
    8: 'Matrices',
  },
};

// Reverse map: topic name → { subject_id, topic_id } for lookup during exam filtering
export const TOPIC_NAME_TO_ID: Record<string, { subject_id: number; topic_id: number }> = (() => {
  const map: Record<string, { subject_id: number; topic_id: number }> = {};
  for (const [sid, topics] of Object.entries(TOPIC_NAMES)) {
    for (const [tid, name] of Object.entries(topics)) {
      map[name] = { subject_id: Number(sid), topic_id: Number(tid) };
    }
  }
  return map;
})();
