'use client'

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { AntiCheatWrapper } from '@/components/exam/AntiCheatWrapper';
import { ExamTimer } from '@/components/exam/ExamTimer';
import { QuestionCard } from '@/components/exam/QuestionCard';
import { QuestionNavigator } from '@/components/exam/QuestionNavigator';
import { Question, SUBJECT_NAMES, TOPIC_NAME_TO_ID } from '@/types';
import toast from 'react-hot-toast';
import { Loader2, ChevronLeft, ChevronRight, Ban, LayoutGrid, X, BookOpen, Target } from 'lucide-react';

export default function ExamScreen() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const supabase = createClient();

  const [sessionData, setSessionData] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [timeSpentOnCurrent, setTimeSpentOnCurrent] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const hasInitialized = useRef(false);
  const syncInProgress = useRef(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Initializing...");

  useEffect(() => {
    async function initExam() {
      console.log("[ExamInit] Starting initialization for session:", sessionId);
      setLoadingStatus("Connecting to exam server...");
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { 
          console.warn("[ExamInit] No user found, redirecting to login");
          router.replace('/login'); 
          return; 
        }

        // 1. Parallel Fetch: Session & Existing Attempts
        setLoadingStatus("Fetching session and history...");
        const [sessionResult, attemptsResult] = await Promise.all([
          supabase.from('exam_sessions').select('*').eq('id', sessionId).single(),
          supabase.from('question_attempts').select('question_id, selected_answer, is_flagged').eq('session_id', sessionId)
        ]);

        const { data: session, error: sessErr } = sessionResult;
        const { data: attempts } = attemptsResult;

        if (sessErr || !session) {
          console.error("[ExamInit] Session fetch error:", sessErr);
          throw new Error('Session not found');
        }

        if (session.status === 'submitted' || session.status === 'abandoned') {
          console.log("[ExamInit] Session already completed, redirecting to results");
          toast.error('This exam has already been submitted.', { id: 'exam_error', duration: 5000 });
          router.replace(`/exam/results/${sessionId}`);
          return;
        }

        setSessionData(session);
        const targetCount = session.total_questions || 40;
        const subjectIds: number[] = session.subject_ids || [1, 2, 3];
        const studentId = session.student_id as string;

        // 2. CHECK RESUMPTION: If attempts exist, load those questions directly
        if (attempts && attempts.length > 0) {
          setLoadingStatus("Resuming your session...");
          console.log(`[ExamInit] Resuming session with ${attempts.length} existing attempts.`);
          
          const qIds = attempts.map(a => a.question_id);
          const { data: resumedQs, error: resumeErr } = await supabase
            .from('questions')
            .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, subject_id, topic_id, difficulty, explanation, shortcut_tip')
            .in('id', qIds);

          if (resumedQs && resumedQs.length > 0) {
            // Reconstruct questions in the original attempt order
            let finalResumed: Question[] = [];
            const orderFromStorage = localStorage.getItem(`exam_order_${sessionId}`);
            const savedOrderIds = orderFromStorage ? JSON.parse(orderFromStorage) : qIds;
            
            savedOrderIds.forEach((id: string) => {
              const q = resumedQs.find(rq => String(rq.id) === String(id));
              if (q) finalResumed.push({ ...q, id: String(q.id) } as Question);
              else if (id.startsWith('fallback-')) {
                // Fallbacks aren't in the DB by UUID usually, and if they were they'd have been synced
                console.warn(`[ExamInit] Could not find quesiton ${id} in DB during resumption`);
              }
            });

            // If we found questions, finish here
            if (finalResumed.length > 0) {
              setQuestions(finalResumed);
              const initialAnswers: Record<string, string | null> = {};
              const initialFlags: Record<string, boolean> = {};
              attempts.forEach(a => {
                initialAnswers[a.question_id] = a.selected_answer;
                initialFlags[a.question_id] = a.is_flagged;
              });
              setAnswers(initialAnswers);
              setFlags(initialFlags);
              hasInitialized.current = true;
              setLoading(false);
              return;
            }
          }
          console.warn("[ExamInit] Attempts found but questions could not be retrieved from DB. Retrying full initialization.");
        }

        // 3. FULL INITIALIZATION (New Session or failed resumption)
        setLoadingStatus("Synchronizing question history...");
        const { data: seenRefs } = await supabase.from('seen_questions').select('question_hash').eq('student_id', user.id);
        const seenHashes = new Set<string>((seenRefs || []).map(r => r.question_hash));
        
        const examType = session.exam_type as string;
        const topicName = examType.includes(':') ? examType.split(':')[1] : null;
        const targetTopicId = topicName ? TOPIC_NAME_TO_ID[topicName]?.topic_id : null;

        setLoadingStatus("Searching question bank...");
        let finalQuestions: Question[] = [];
        let query = supabase
          .from('questions')
          .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, subject_id, topic_id, difficulty, explanation, shortcut_tip')
          .in('subject_id', subjectIds);

        if (targetTopicId) query = query.eq('topic_id', targetTopicId);

        // Increased limit to account for heavy deduplication
        const { data: dbQuestions, error: dbErr } = await query.limit(1000); 
        
        if (dbQuestions) {
          console.log(`[ExamInit] Found ${dbQuestions.length} candidates in DB.`);
          for (const q of dbQuestions) {
            const hash = q.question_text.trim().toLowerCase().substring(0, 60);
            if (!seenHashes.has(hash)) {
              finalQuestions.push({ ...q, id: String(q.id) } as Question);
              seenHashes.add(hash);
            }
            if (finalQuestions.length >= targetCount) break;
          }
        }

        // 4. Fallbacks (JSON file)
        if (finalQuestions.length < targetCount) {
          const neededFromJSON = targetCount - finalQuestions.length;
          setLoadingStatus(`Checking prep material for ${neededFromJSON} more questions...`);
          try {
            const res = await fetch('/questions.json');
            if (res.ok) {
              const fallbackQs: Question[] = await res.json();
              console.log(`[ExamInit] Loaded ${fallbackQs.length} potential questions from JSON.`);
              
              let filtered = fallbackQs.filter(fq => subjectIds.includes(fq.subject_id));
              if (targetTopicId) filtered = filtered.filter(fq => fq.topic_id === targetTopicId);

              const startCount = finalQuestions.length;
              let fallbackIndex = 0;
              for (const fq of filtered) {
                if (finalQuestions.length >= targetCount) break;
                const hash = fq.question_text.trim().toLowerCase().substring(0, 60);
                if (!seenHashes.has(hash)) {
                  finalQuestions.push({ ...fq, id: `fallback-${fallbackIndex++}` });
                  seenHashes.add(hash);
                }
              }
              console.log(`[ExamInit] Added ${finalQuestions.length - startCount} unique questions from JSON.`);
            }
          } catch (e) { console.error('[ExamInit] Fallback error:', e); }
        }

        // 5. AI Generation (Ultra-Conservative for Free Tier Rate Limits)
        if (finalQuestions.length < targetCount && (session.source === 'AI Generated' || session.source === 'Mixed')) {
          const needed = targetCount - finalQuestions.length;
          setLoadingStatus(`Gemini AI is generating ${needed} unique questions...`);
          
          try {
            // Increased batch size to reduce total request count
            const BATCH_SIZE = 25; 
            const numBatches = Math.ceil(needed / BATCH_SIZE);
            const allAiQs: any[] = [];

            console.log(`[ExamInit] Sequential mode: ${numBatches} batches. Waiting 6s between requests to bypass Free Tier limits.`);

            for (let i = 0; i < numBatches; i++) {
              const currentBatchCount = Math.min(BATCH_SIZE, targetCount - (finalQuestions.length + allAiQs.length));
              if (currentBatchCount <= 0) break;

              setLoadingStatus(`Gemini AI: Working on Batch ${i + 1}/${numBatches}... (${Math.round((allAiQs.length / needed) * 100)}%)`);

              let success = false;
              let attemptsCount = 0;
              while (!success && attemptsCount < 3) {
                attemptsCount++;
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 60000);

                  const res = await fetch('/api/gemini/generate-questions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: controller.signal,
                    body: JSON.stringify({
                      topic_name: topicName || 'General',
                      subject_name: subjectIds.map(id => SUBJECT_NAMES[id]).join(', '),
                      count: currentBatchCount,
                      difficulty: session.difficulty || 'medium',
                    }),
                  });
                  
                  clearTimeout(timeoutId);

                  if (res.ok) {
                    const data = await res.json();
                    if (data.questions && Array.isArray(data.questions)) {
                      allAiQs.push(...data.questions);
                      success = true;
                    }
                  } else if (res.status === 429) {
                    setLoadingStatus(`Gemini is busy. Waiting 10s to cool down...`);
                    await new Promise(r => setTimeout(r, 10000));
                  }
                } catch (err) {
                  console.error(`[ExamInit] Batch ${i} Attempt ${attemptsCount} error:`, err);
                  await new Promise(r => setTimeout(r, 3000));
                }
              }

              // Cooldown between batches to strictly stay within 15 RPM
              if (i < numBatches - 1) {
                await new Promise(r => setTimeout(r, 6000));
              }
            }
            
            finalQuestions = [...finalQuestions, ...allAiQs.map((q: any) => ({
              ...q, 
              id: String(q.id), 
              subject_id: q.subject_id || subjectIds[0] || 1
            }))].slice(0, targetCount);
            
            console.log(`[ExamInit] Total AI questions generated: ${finalQuestions.length}`);
          } catch (e) { console.error('[ExamInit] AI Overall Error:', e); }
        }

        if (finalQuestions.length > 0) {
          setLoadingStatus("Finalizing preparation...");
          
          // Sync fallbacks to DB to get real UUIDs (important for attempts tracking)
          try {
            const syncRes = await fetch('/api/questions/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ questions: finalQuestions }),
            });
            if (syncRes.ok) {
              const syncData = await syncRes.json();
              if (syncData.questions) finalQuestions = syncData.questions;
            }
          } catch (syncErr) { console.error(`[ExamInit] Sync Error:`, syncErr); }

          // Shuffle
          for (let i = finalQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
          }

          localStorage.setItem(`exam_order_${sessionId}`, JSON.stringify(finalQuestions.map(q => q.id)));
          setQuestions(finalQuestions);
          
          // Mark as seen
          const seenInserts = finalQuestions
            .filter(q => typeof q.id === 'string' && !q.id.startsWith('fallback-'))
            .map(q => ({
              student_id: studentId,
              question_id: q.id,
              question_hash: q.question_text.trim().toLowerCase().substring(0, 60),
            }));

          if (seenInserts.length > 0) {
            supabase.from('seen_questions').upsert(seenInserts, { onConflict: 'student_id,question_hash' }).then();
          }
          hasInitialized.current = true;
        } else {
          toast.error('No questions available. Please try a different subject or Mixed mode.');
        }
        setLoading(false);
      } catch (err: any) {
        console.error("[ExamInit] Critical Error:", err);
        toast.error(err.message);
        router.replace('/dashboard');
      }
    }
    initExam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Per-question timer
  useEffect(() => {
    if (loading || isSubmitting || questions.length === 0) return;
    setTimeSpentOnCurrent(0);
    const timer = setInterval(() => setTimeSpentOnCurrent(p => p + 1), 1000);
    return () => clearInterval(timer);
  }, [currentIndex, loading, isSubmitting, questions.length]);

  const saveAnswerToDB = useCallback(async (qId: string, answer: string | null, isFlagged: boolean = false) => {
    const studentId = sessionData?.student_id;
    if (!studentId) {
      console.warn(`[ExamSession] Cannot save answer - no studentId for session ${sessionId}`);
      return;
    }

    if (qId.startsWith('fallback-')) return;

    try {
      const { error } = await supabase.from('question_attempts').upsert({
        session_id: sessionId,
        student_id: studentId,
        question_id: qId,
        selected_answer: answer,
        is_flagged: isFlagged,
        time_spent_seconds: timeSpentOnCurrent,
      }, { onConflict: 'session_id,question_id' });

      if (error) {
        console.error(`[ExamSession] Error saving answer for Q ${qId}:`, error.message);
      }
    } catch (e) {
      console.error(`[ExamSession] Exception in saveAnswerToDB for Q ${qId}:`, e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionData, timeSpentOnCurrent]);

  const handleSelectAnswer = (answer: string) => {
    const qId = questions[currentIndex].id;
    const isSame = answers[qId] === answer;
    const newAnswer = isSame ? null : answer;
    setAnswers(prev => ({ ...prev, [qId]: newAnswer }));
    if (!isSame && currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 300);
    }
    saveAnswerToDB(qId, newAnswer, flags[qId]);
  };

  const handleToggleFlag = () => {
    const qId = questions[currentIndex].id;
    const newValue = !flags[qId];
    setFlags(prev => ({ ...prev, [qId]: newValue }));
    saveAnswerToDB(qId, answers[qId] || null, newValue);
  };

  const submitExam = useCallback(async (reason: string = 'user_submitted') => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    toast.loading('Calculating your score...', { id: 'submit' });

    try {
      const studentId = sessionData?.student_id;
      if (!studentId) throw new Error("Missing student information");

      // Get correct answers for all items
      let correctAnswerMap: Record<string, string> = {};
      questions.forEach(q => {
        if (q.correct_answer) correctAnswerMap[q.id] = q.correct_answer;
      });

      // Difficulty-based scoring
      const difficulty = sessionData?.difficulty || 'medium';
      const scoringMap: Record<string, { correct: number; wrong: number }> = {
        easy: { correct: 1, wrong: 0 },
        medium: { correct: 2, wrong: -0.5 },
        hard: { correct: 4, wrong: -1 },
        expert: { correct: 4, wrong: -1 },
      };
      const scoring = scoringMap[difficulty] ?? { correct: 4, wrong: -1 };

      // Scoring & Persistence Loop
      let score = 0;
      const attemptInserts: any[] = [];

      console.log(`[ExamSubmit] Processing ${questions.length} questions. Answers keys:`, Object.keys(answers));

      // We process ALL questions in the exam set to ensure counts and review records are accurate
      for (const q of questions) {
        const selected = answers[q.id] || null;
        const correct = correctAnswerMap[q.id];

        if (selected) {
          console.log(`[ExamSubmit] Q ID ${q.id}: Selected ${selected}, Correct ${correct}`);
        } else {
          console.log(`[ExamSubmit] Q ID ${q.id}: Skipped`);
        }

        // Only calculate correctness if an answer was provided
        const isCorrect = selected ? (selected === correct) : null;

        if (selected) {
          score += isCorrect ? scoring.correct : scoring.wrong;
        }

        // We can only save attempts for questions with real database UUID wrappers
        if (q.id && !q.id.startsWith('fallback-') && !q.id.startsWith('ai-')) {
          attemptInserts.push({
            session_id: sessionId,
            student_id: studentId,
            question_id: q.id,
            selected_answer: selected,
            is_correct: isCorrect,
            is_flagged: flags[q.id] ?? false,
            time_spent_seconds: 0
          });
        } else {
          console.warn(`[ExamSubmit] Skipping DB persistence for question ${q.id} (not a UUID)`);
        }
      }

      // Batch upsert for speed and reliability - ensures all questions appear in review
      if (attemptInserts.length > 0) {
        console.log(`[ExamSubmit] Upserting ${attemptInserts.length} attempts (including skipped)...`);
        const { error: upsertErr } = await supabase
          .from('question_attempts')
          .upsert(attemptInserts, { onConflict: 'session_id,question_id' });

        if (upsertErr) {
          console.error("[ExamSubmit] Batch upsert failed:", upsertErr.message);
          // If we fail here, we don't block submission but log the error
        }
      }

      const maxScore = questions.length * scoring.correct;
      const finalScore = Math.max(0, Math.round(score));

      console.log(`[ExamSubmit] Final Score: ${finalScore}/${maxScore}, Status: submitted`);

      const { error: updateErr } = await supabase.from('exam_sessions').update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        score: finalScore,
        max_score: maxScore,
      }).eq('id', sessionId);

      if (updateErr) throw updateErr;

      localStorage.removeItem(`exam_time_${sessionId}`);
      toast.success('Exam submitted!', { id: 'submit' });
      router.replace(`/exam/results/${sessionId}`);
    } catch (e: any) {
      console.error('[ExamSubmit] Critical Failure:', e);
      toast.error('Failed to submit: ' + e.message, { id: 'submit' });
      setIsSubmitting(false);
    }
  }, [sessionId, sessionData, questions, answers, flags, isSubmitting, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-6 p-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <Target className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-indigo-600 font-bold text-lg animate-pulse">{loadingStatus}</p>
          <p className="text-slate-400 text-sm max-w-xs">Please stay on this page. Do not refresh or exit while we prepare your exam.</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    const isPastPaperOnly = sessionData?.source === 'Past Papers Only';
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4 p-6 text-center">
        <Ban className="w-12 h-12 text-slate-400" />
        <h2 className="text-xl font-bold text-slate-700">No Questions Available</h2>
        <p className="text-slate-500 max-w-sm">
          {sessionData?.source === 'Past Papers Only' 
            ? "We couldn't find any past paper questions for these subjects. Try 'AI Generated' or 'Mixed' mode instead."
            : "The question bank is empty. Ask your admin to add questions or generate them via Gemini."
          }
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <button onClick={() => router.push('/dashboard')} className="px-6 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">Return to Dashboard</button>
          {sessionData?.source === 'Past Papers Only' && (
            <button 
              onClick={() => router.push('/exam/setup')} 
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
            >
              Change to Mixed Mode
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const subjectName = SUBJECT_NAMES[currentQ.subject_id] || `Subject ${currentQ.subject_id}`;
  const subjectColorClass = currentQ.subject_id === 1 ? 'text-indigo-700 bg-indigo-50' :
    currentQ.subject_id === 2 ? 'text-amber-700 bg-amber-50' :
      'text-emerald-700 bg-emerald-50';

  return (
    <AntiCheatWrapper sessionId={sessionId} onAutoSubmit={submitExam}>
      <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none overflow-hidden h-screen">

        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm z-10 relative">
          <div className="flex items-center gap-3">
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${subjectColorClass}`}>
              <BookOpen className="w-4 h-4" />
              {subjectName}
            </div>
            <span className="text-sm text-slate-500 font-medium">
              Q {currentIndex + 1}/{questions.length}
            </span>
            {sessionData.exam_type.includes(':') && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 uppercase tracking-wider">
                <Target className="w-3.5 h-3.5" />
                {sessionData.exam_type.split(':')[1]}
              </div>
            )}
          </div>

          {/* Centered Timer */}
          <div className="flex items-center justify-center absolute left-1/2 -translate-x-1/2">
            <ExamTimer
              initialMinutes={sessionData.time_limit_minutes}
              sessionId={sessionId}
              onTimeUp={() => submitExam('time_up')}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmitting}
              className="px-3 sm:px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Full-screen Submission Overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <h2 className="text-2xl font-bold text-slate-800">Submitting Exam...</h2>
              <p className="text-slate-500 mt-2 text-center max-w-sm">Please wait while we save your answers and generate your results. This may take a few seconds.</p>
            </div>
          )}

          {/* Question Area */}
          <div className={`flex-1 p-4 sm:p-6 overflow-hidden flex flex-col items-center ${isSubmitting ? 'pointer-events-none blur-sm' : ''}`}>
            <div className="w-full max-w-4xl h-full flex flex-col gap-4">
              <QuestionCard
                question={currentQ}
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                selectedAnswer={answers[currentQ.id] ?? null}
                onSelectAnswer={handleSelectAnswer}
                isFlagged={flags[currentQ.id] ?? false}
                onToggleFlag={handleToggleFlag}
                isReviewMode={false}
              />

              {/* Bottom Nav */}
              <div className="flex justify-between items-center shrink-0 mt-2 gap-3">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="px-5 py-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all"
                >
                  <ChevronLeft className="w-5 h-5" /> Prev
                </button>

                <button
                  onClick={() => {
                    setAnswers(prev => ({ ...prev, [currentQ.id]: null }));
                    saveAnswerToDB(currentQ.id, null, flags[currentQ.id]);
                  }}
                  className="px-4 py-3 bg-white border border-slate-300 rounded-xl font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm hidden sm:block text-sm"
                >
                  Clear
                </button>

                <button
                  onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
                  disabled={currentIndex === questions.length - 1}
                  className="px-5 py-3 bg-indigo-600 border border-transparent rounded-xl font-medium text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-indigo-200 transition-all"
                >
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Navigator Sidebar / Mobile Drawer */}
          {isMobileNavOpen && (
            <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setIsMobileNavOpen(false)} />
          )}
          <div className={`
            fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300
            lg:static lg:w-72 xl:w-80 lg:rounded-none lg:shadow-none lg:bg-slate-50 lg:border-l lg:border-slate-200 lg:translate-y-0
            ${isMobileNavOpen ? 'translate-y-0' : 'translate-y-full'}
          `}>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center lg:hidden">
              <span className="font-bold text-slate-800">Question Navigator</span>
              <button onClick={() => setIsMobileNavOpen(false)} className="p-2 text-slate-500 bg-slate-100 rounded-full">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh] lg:max-h-none h-full flex flex-col gap-4">
              <QuestionNavigator
                totalCount={questions.length}
                currentIndex={currentIndex}
                answers={answers}
                flags={flags}
                questionIds={questions.map(q => q.id)}
                onSelect={(idx) => {
                  setCurrentIndex(idx);
                  setIsMobileNavOpen(false);
                }}
              />
            </div>
          </div>
        </div>
        {/* Inline Submit Confirmation Modal — replaces unreliable window.confirm() */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in fade-in zoom-in-95">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Submit Exam?</h2>
              <p className="text-slate-500 mb-1">
                <span className="font-semibold text-slate-700">
                  {Object.values(answers).filter(Boolean).length}
                </span> of <span className="font-semibold text-slate-700">{questions.length}</span> questions answered.
              </p>
              {questions.length - Object.values(answers).filter(Boolean).length > 0 && (
                <p className="text-amber-600 text-sm font-medium mb-4">
                  ⚠️ {questions.length - Object.values(answers).filter(Boolean).length} unanswered question(s) will be marked as skipped.
                </p>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSubmitConfirm(false);
                    submitExam('user_submitted');
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors"
                >
                  Yes, Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AntiCheatWrapper>
  );
}
