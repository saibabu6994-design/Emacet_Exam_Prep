'use client'

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { Question } from '@/types';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp, Zap } from 'lucide-react';

export default function ExamResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const supabase = createClient();

  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQId, setExpandedQId] = useState<string | null>(null);
  
  // AI Explanation State
  const [explanations, setExplanations] = useState<Record<string, any>>({});
  const [loadingExpl, setLoadingExpl] = useState<string | null>(null);

  useEffect(() => {
    async function loadResults() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/login');
          return;
        }

        // 1. Fetch Session
        const { data: sessData, error: sessErr } = await supabase
          .from('exam_sessions')
          .select('*, students(id, full_name)')
          .eq('id', sessionId)
          .single();

        if (sessErr || !sessData) throw new Error("Session not found");
        setSession(sessData);

        // 2. Fetch Attempts
        const { data: attData, error: attErr } = await supabase
          .from('question_attempts')
          .select('*')
          .eq('session_id', sessionId);
          
        if (attErr) throw attErr;
        setAttempts(attData || []);

        // 3. Fetch Questions (we need correct answers now)
        const qIds = attData?.map(a => a.question_id) || [];
        if (qIds.length > 0) {
           const { data: qData, error: qErr } = await supabase
             .from('questions')
             .select('*')
             .in('id', qIds);
             
           if (qErr) throw qErr;
           
           // Restore the original exam order from localStorage (saved during initExam)
           const savedOrder = localStorage.getItem(`exam_order_${sessionId}`);
           if (savedOrder) {
             try {
                const orderIds = JSON.parse(savedOrder);
                const sortedData = (qData as Question[]).sort((a, b) => {
                  return orderIds.indexOf(a.id) - orderIds.indexOf(b.id);
                });
                setQuestions(sortedData);
             } catch (e) {
                console.error("Order restore failed", e);
                setQuestions((qData as Question[]) || []);
             }
           } else {
             // Fallback to attempt order if localStorage is cleared
             const sortedData = (qData as Question[]).sort((a, b) => {
               return qIds.indexOf(a.id) - qIds.indexOf(b.id);
             });
             setQuestions(sortedData || []);
           }
        }

        setLoading(false);
      } catch (err: any) {
        toast.error("Failed to load results: " + err.message);
        setLoading(false);
      }
    }
    loadResults();
  }, [sessionId, router, supabase]);

  const loadExplanation = async (qId: string) => {
      // Toggle off if already open
      if (expandedQId === qId) {
          setExpandedQId(null);
          return;
      }
      
      setExpandedQId(qId);
      
      // If already fetched, don't fetch again
      if (explanations[qId] || loadingExpl === qId) return;

      try {
          setLoadingExpl(qId);
          const q = questions.find(x => x.id === qId);
          const a = attempts.find(x => x.question_id === qId);
          if (!q || !a) return;

          const res = await fetch('/api/gemini/explain-answer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  question_text: q.question_text,
                  options: {
                      A: q.option_a,
                      B: q.option_b,
                      C: q.option_c,
                      D: q.option_d,
                  },
                  student_selected: a.selected_answer || "Skipped",
                  correct_answer: q.correct_answer,
                  source_contexts: [] // Pass source context if available
              })
          });

          if (!res.ok) throw new Error("API failed");
          
          const data = await res.json();
          setExplanations(prev => ({ ...prev, [qId]: data }));
          
          // Optionally save to DB cache if we had a column for it

      } catch (err: any) {
          toast.error("Failed to load AI explanation.");
      } finally {
          setLoadingExpl(null);
      }
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
  }

  if (!session) return <div>Test not found</div>;

  // Calculate stats
  const total = session.total_questions;
  const attempted = attempts.filter(a => a.selected_answer).length;
  const correct = attempts.filter(a => a.is_correct).length;
  const wrong = attempted - correct;
  const skipped = total - attempted;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  
  const timeLimitMs = (session.time_limit_minutes || 0) * 60 * 1000;
  const timeTakenMs = session.submitted_at ? new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime() : 0;
  const m = Math.floor(timeTakenMs / 60000);
  const s = Math.floor((timeTakenMs % 60000) / 1000);

  const difficultyMap: Record<string, { correct: number; wrong: number }> = {
    easy: { correct: 1, wrong: 0 },
    medium: { correct: 2, wrong: -0.5 },
    hard: { correct: 4, wrong: -1 },
    expert: { correct: 4, wrong: -1 },
  };
  const diffKey = session.difficulty || 'hard';
  const pts = difficultyMap[diffKey] ?? { correct: 4, wrong: -1 };

  return (
    <div className="max-w-5xl mx-auto space-y-8 mt-10 p-6 pb-20">
      <div className="flex justify-between items-center">
         <div>
             <h1 className="text-3xl font-bold text-slate-800">Exam Results</h1>
             <p className="text-slate-500 mt-1">{session.students?.full_name || 'Student'} • {new Date(session.submitted_at).toLocaleString()}</p>
         </div>
         <button onClick={() => router.push('/dashboard')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Go to Dashboard</button>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-100">
               <div className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-2">Final Score</div>
               <div className="text-5xl font-black text-indigo-600 tracking-tighter">{session.score} <span className="text-xl text-slate-400 font-medium">/ {session.max_score}</span></div>
            </div>
            
            <div className="flex flex-col justify-center space-y-4">
               <div>
                  <div className="flex justify-between text-sm mb-1">
                     <span className="text-slate-500 font-medium">Accuracy</span>
                     <span className="font-bold text-slate-800">{accuracy}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                     <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${accuracy}%` }}></div>
                  </div>
               </div>
               
               <div className="flex justify-between text-sm items-center">
                  <span className="text-slate-500 font-medium">Time Taken</span>
                  <span className="font-bold text-slate-800">{m}m {s}s <span className="text-slate-400 font-normal">/ {session.time_limit_minutes}m</span></span>
               </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-3 gap-4">
               <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500 mb-2"/>
                  <span className="text-2xl font-bold text-emerald-700">{correct}</span>
                  <span className="text-xs font-semibold text-emerald-600 uppercase">Correct</span>
               </div>
               <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <XCircle className="w-6 h-6 text-red-500 mb-2"/>
                  <span className="text-2xl font-bold text-red-700">{wrong}</span>
                  <span className="text-xs font-semibold text-red-600 uppercase">Wrong</span>
               </div>
               <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-slate-700 mt-8">{skipped}</span>
                  <span className="text-xs font-semibold text-slate-500 uppercase mt-2">Skipped</span>
               </div>
            </div>
         </div>
      </div>

      {/* Answer Review Section */}
      <div>
         <h2 className="text-xl font-bold text-slate-800 mb-6">Detailed Review</h2>
         
         <div className="space-y-6">
            {questions.map((q, i) => {
               const attempt = attempts.find(a => a.question_id === q.id);
               const isCorrect = attempt?.is_correct;
               const isSkipped = !attempt?.selected_answer;
               
               const expl = explanations[q.id];
               const isExpanded = expandedQId === q.id;
               
               return (
                 <div key={q.id} className={`bg-white rounded-xl border-2 overflow-hidden shadow-sm transition-colors ${
                     isCorrect ? 'border-emerald-200' : isSkipped ? 'border-slate-200' : 'border-red-200'
                 }`}>
                    {/* Header bar */}
                    <div className={`px-6 py-3 flex justify-between items-center bg-slate-50 border-b ${
                        isCorrect ? 'border-emerald-100 bg-emerald-50/50' : isSkipped ? 'border-slate-100' : 'border-red-100 bg-red-50/50'
                    }`}>
                        <div className="flex items-center gap-3">
                           <span className="font-bold text-slate-700">Q{i + 1}</span>
                           <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                               isCorrect ? 'bg-emerald-100 text-emerald-700' : isSkipped ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-700'
                           }`}>
                               {isCorrect
                                  ? `Correct (+${pts.correct})`
                                  : isSkipped
                                  ? 'Skipped (0)'
                                  : `Wrong (${pts.wrong})`}
                           </span>
                        </div>
                        <div className="text-sm text-slate-500 font-medium">Time: {attempt?.time_spent_seconds || 0}s</div>
                    </div>

                    {/* Question Content */}
                    <div className="p-6">
                       <QuestionCard 
                          question={q}
                          currentIndex={i}
                          totalQuestions={total}
                          selectedAnswer={attempt?.selected_answer}
                          onSelectAnswer={() => {}}
                          isFlagged={attempt?.is_flagged || false}
                          onToggleFlag={() => {}}
                          isReviewMode={true}
                          correctAnswer={q.correct_answer}
                       />

                       {/* AI Explanations */}
                       <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col items-center">
                          <button 
                             onClick={() => loadExplanation(q.id)}
                             className="flex items-center justify-between w-full p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors rounded-xl group"
                          >
                             <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-indigo-600 text-white rounded-lg"><Zap className="w-4 h-4" /></div>
                                <span className="font-semibold text-indigo-900 group-hover:text-indigo-700">AI Explanation & Shortcuts</span>
                             </div>
                             {loadingExpl === q.id ? (
                                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                             ) : isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-indigo-400" />
                             ) : (
                                <ChevronDown className="w-5 h-5 text-indigo-400" />
                             )}
                          </button>
                          
                          {isExpanded && expl && (
                              <div className="w-full mt-4 p-6 bg-white border border-indigo-100 rounded-xl space-y-6 shadow-sm">
                                 <div>
                                    <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                       <CheckCircle className="w-4 h-4"/> Why {q.correct_answer} is Correct
                                    </h4>
                                    <p className="text-slate-700">{expl.why_correct || q.explanation}</p>
                                 </div>
                                 
                                 {!isCorrect && !isSkipped && expl.why_wrong && (
                                     <div>
                                        <h4 className="text-xs font-bold text-red-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                                           <XCircle className="w-4 h-4"/> Why you might have chosen {attempt?.selected_answer}
                                        </h4>
                                        <p className="text-slate-700">{expl.why_wrong}</p>
                                     </div>
                                 )}

                                 {(expl.shortcut || q.shortcut_tip) && (
                                     <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-2">
                                           Shortcut Trick
                                        </h4>
                                        <p className="text-amber-900 font-medium">{expl.shortcut || q.shortcut_tip}</p>
                                     </div>
                                 )}
                              </div>
                          )}
                       </div>
                    </div>
                 </div>
               )
            })}
         </div>
      </div>
    </div>
  );
}
