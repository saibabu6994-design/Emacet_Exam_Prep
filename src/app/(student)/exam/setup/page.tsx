'use client'

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { BookOpen, Clock, Settings, Play, Zap, ChevronRight, Target } from "lucide-react";
import toast from "react-hot-toast";
import useStore from "@/store/examStore";

const EXAM_MODES = [
  { id: 'Full Mock', label: 'Full Mock', questions: 160, time: 180, desc: '160 Qs · 3 hrs' },
  { id: 'Subject Test', label: 'Subject Test', questions: null, time: null, desc: '40 Qs/sub · 60 min/sub' },
  { id: 'Quick Practice', label: 'Quick Practice', questions: 20, time: 30, desc: '20 Qs · 30 min' },
];

const SUBJECTS = [
  { id: 1, name: 'Physics', color: 'border-indigo-400 bg-indigo-50 text-indigo-700' },
  { id: 2, name: 'Chemistry', color: 'border-amber-400 bg-amber-50 text-amber-700' },
  { id: 3, name: 'Mathematics', color: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
];

const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', desc: '20 Qs · 30 min · No negative', color: 'border-emerald-400' },
  { id: 'medium', label: 'Medium', desc: '30 Qs · 60 min · -0.5 per wrong', color: 'border-amber-400' },
  { id: 'hard', label: 'Hard', desc: '40 Qs · 90 min · -1 per wrong', color: 'border-red-400' },
  { id: 'expert', label: 'Expert 🔥', desc: '40 Qs · 120 min · -1 per wrong', color: 'border-rose-600' },
];

const SOURCES = [
  { id: 'Past Papers Only', label: 'Past Papers Only' },
  { id: 'Mixed', label: 'Mixed (Recommended)' },
  { id: 'AI Generated', label: 'AI Generated' },
];

export default function ExamSetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { setCurrentSession } = useStore();

  const [mode, setMode] = useState("Quick Practice");
  const [subjects, setSubjects] = useState<number[]>([]);
  const [source, setSource] = useState("Mixed");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);

  // Read URL params for topic-based practice
  const topicParam = searchParams.get('topic');
  const subjectParam = searchParams.get('subject');

  useEffect(() => {
    if (subjectParam) {
      setSubjects([Number(subjectParam)]);
    } else {
      setSubjects([1, 2, 3]);
    }
    if (topicParam) {
      setMode("Quick Practice");
    } else {
       setMode("Full Mock");
    }
  }, [subjectParam, topicParam]);

  const handleSubjectToggle = (id: number) => {
    // If practicing a specific topic, don't allow changing subject
    if (topicParam) return;
    setSubjects(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const startExam = async () => {
    if (subjects.length === 0) {
      toast.error("Please select at least one subject.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const studentId = user.id;

      let totalQuestions = 160;
      let timeLimit = 180;

      const modeConfig = EXAM_MODES.find(m => m.id === mode);
      if (mode === 'Subject Test') {
        totalQuestions = 40 * subjects.length;
        timeLimit = 60 * subjects.length;
      } else if (modeConfig?.questions) {
        totalQuestions = modeConfig.questions;
        timeLimit = modeConfig.time!;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert({
          student_id: studentId,
          // Store topic in exam_type to keep it simple without DB migrations
          exam_type: topicParam ? `practice:${topicParam}` : 'practice',
          subject_ids: subjects,
          total_questions: totalQuestions,
          time_limit_minutes: timeLimit,
          max_score: totalQuestions * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 4),
          status: 'in_progress',
          difficulty: difficulty,
          source: source,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      setCurrentSession(sessionData.id);
      toast.success("Starting exam...");
      router.push(`/exam/${sessionData.id}`);

    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 mt-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800">Configure Your Exam</h1>
        <p className="text-slate-500 mt-2">Customize your practice session.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">

        {/* Topic Context (if applicable) */}
        {topicParam && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-lg">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Practicing Topic</p>
                <p className="text-lg font-bold text-indigo-900">{topicParam}</p>
              </div>
            </div>
            <button 
              onClick={() => router.replace('/exam/setup')}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline underline-offset-4"
            >
              Change
            </button>
          </div>
        )}

        {/* Exam Mode */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
            <Settings className="w-4 h-4 text-indigo-500" /> Exam Mode
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {EXAM_MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${mode === m.id ? 'border-indigo-600 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:border-indigo-300'}`}
              >
                <div className={`font-semibold text-sm ${mode === m.id ? 'text-indigo-800' : 'text-slate-700'}`}>{m.label}</div>
                <div className="text-xs mt-1 text-slate-400">{m.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Subjects */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
            <BookOpen className="w-4 h-4 text-emerald-500" /> Subjects
          </div>
          <div className="flex flex-wrap gap-3">
            {SUBJECTS.map(sub => {
              const isActive = subjects.includes(sub.id);
              return (
                <button
                  key={sub.id}
                  onClick={() => handleSubjectToggle(sub.id)}
                  className={`px-5 py-2.5 rounded-full border-2 text-sm font-semibold transition-all ${isActive ? sub.color + ' border-current' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  {sub.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Difficulty */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
            <Zap className="w-4 h-4 text-amber-500" /> Difficulty
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${difficulty === d.id ? d.color + ' bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className={`font-bold text-sm ${difficulty === d.id ? 'text-slate-800' : 'text-slate-600'}`}>{d.label}</div>
                <div className="text-xs text-slate-400 mt-1 leading-tight">{d.desc}</div>
              </button>
            ))}
          </div>
          {difficulty === 'expert' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              ⚠️ Expert mode: Questions take 8–12 min each. Simulates the hardest TS EAMCET questions.
            </div>
          )}
        </section>

        {/* Source */}
        <section className="space-y-3">
          <div className="text-sm font-bold text-slate-700 uppercase tracking-wider">Question Source</div>
          <div className="flex flex-wrap gap-3">
            {SOURCES.map(s => (
              <button
                key={s.id}
                onClick={() => setSource(s.id)}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${source === s.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          onClick={startExam}
          disabled={loading || subjects.length === 0}
          className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading ? (
            <span className="w-6 h-6 border-2 border-white border-t-transparent flex-shrink-0 animate-spin rounded-full" />
          ) : (
            <Play className="w-5 h-5 fill-current flex-shrink-0" />
          )}
          Start Exam
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
