'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { AlertCircle, ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import useStore from "@/store/examStore";
import { TOPIC_NAMES, SUBJECT_NAMES } from "@/types";

type TopicMistake = {
    topic: string;
    topicName: string;
    subject: string;
    subjectId: number;
    wrongCount: number;
    totalAttempts: number;
    accuracy: number;
};

export default function MistakeTrackerPage() {
    const supabase = createClient();
    const router = useRouter();
    const { setCurrentSession } = useStore();
    
    const [mistakes, setMistakes] = useState<TopicMistake[]>([]);
    const [loading, setLoading] = useState(true);
    const [isStartingDrill, setIsStartingDrill] = useState(false);

    useEffect(() => {
        async function fetchMistakes() {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.replace('/login');

                const studentId = user.id;

                // Fetch all attempts (both correct and incorrect) to compute real accuracy
                const { data: allAttempts, error } = await supabase
                    .from('question_attempts')
                    .select('is_correct, questions(subject_id, topic_id)')
                    .eq('student_id', studentId);
                    
                if (error) throw error;
                
                // Aggregate by subject+topic
                const topicStats: Record<string, { subjectId: number; topicId: number; wrong: number; total: number }> = {};
                
                allAttempts?.forEach((a: any) => {
                    const sid = a.questions?.subject_id || 1;
                    const tid = a.questions?.topic_id || 1;
                    const key = `${sid}-${tid}`;
                    
                    if (!topicStats[key]) {
                        topicStats[key] = { subjectId: sid, topicId: tid, wrong: 0, total: 0 };
                    }
                    topicStats[key].total++;
                    if (!a.is_correct) topicStats[key].wrong++;
                });

                // Only show topics where user has wrong answers
                const dataArr = Object.values(topicStats)
                    .filter(s => s.wrong > 0)
                    .map(s => {
                        // Resolve real topic name from the TOPIC_NAMES map
                        const topicName = TOPIC_NAMES[s.subjectId]?.[s.topicId] ?? `Topic ${s.topicId}`;
                        const accuracy = s.total > 0 ? Math.round(((s.total - s.wrong) / s.total) * 100) : 0;
                        return {
                            topic: `${s.subjectId}-${s.topicId}`,
                            topicName,
                            subject: SUBJECT_NAMES[s.subjectId] ?? 'Unknown',
                            subjectId: s.subjectId,
                            wrongCount: s.wrong,
                            totalAttempts: s.total,
                            accuracy,
                        };
                    })
                    .sort((a, b) => b.wrongCount - a.wrongCount);

                setMistakes(dataArr);

            } catch (err: any) {
                toast.error("Failed to load mistakes.");
            } finally {
                setLoading(false);
            }
        }
        
        fetchMistakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startMistakeDrill = async () => {
        setIsStartingDrill(true);
        toast.loading("Preparing your Mistake Drill...", { id: 'drill' });

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');
            const studentId = user.id;

            // Find all unique question IDs where the user got them wrong
            const { data: wrongAttempts } = await supabase
                .from('question_attempts')
                .select('question_id')
                .eq('student_id', studentId)
                .eq('is_correct', false);

            if (!wrongAttempts || wrongAttempts.length === 0) {
                 toast.success("You don't have any mistakes to review!", { id: 'drill' });
                 setIsStartingDrill(false);
                 return;
            }

            // Deduplicate question IDs
            const uniqueQs = Array.from(new Set(wrongAttempts.map(a => a.question_id)));

            // Create drill session
            const { data: sessionData, error: sessionError } = await supabase.from('exam_sessions').insert({
                student_id: studentId,
                exam_type: 'mistake_drill',
                subject_ids: [1,2,3], // all
                total_questions: uniqueQs.length,
                time_limit_minutes: uniqueQs.length * 2, // 2 mins per Q
                max_score: uniqueQs.length * 4,
                status: 'in_progress'
            }).select().single();

            if (sessionError) throw sessionError;

            setCurrentSession(sessionData.id);
            
            toast.success(`Starting drill with ${uniqueQs.length} questions`, { id: 'drill' });
            router.push(`/exam/${sessionData.id}`);

        } catch (error: any) {
            toast.error(error.message, { id: 'drill' });
            setIsStartingDrill(false);
        }
    }

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">Loading mistake analytics...</div>;

    return (
        <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                   <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Mistake Tracker</h1>
                   <p className="text-slate-500 mt-2">Review your weak areas and practice specific topics.</p>
                </div>
                
                <button 
                   onClick={startMistakeDrill}
                   disabled={isStartingDrill || mistakes.length === 0}
                   className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                   <Play className="w-5 h-5 fill-current" />
                   Retry All Mistakes
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                     <AlertCircle className="w-5 h-5 text-red-500" />
                     <h2 className="font-semibold text-slate-800">My Weak Areas</h2>
                     {mistakes.length > 0 && (
                       <span className="ml-auto text-xs font-medium text-slate-400">{mistakes.length} topic{mistakes.length !== 1 ? 's' : ''} need practice</span>
                     )}
                </div>

                {mistakes.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                             <div className="text-2xl">🎉</div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">No mistakes found!</h3>
                        <p className="text-slate-500 mt-2">You either haven't taken any exams yet, or you've been answering flawlessly.</p>
                        <Link href="/exam/setup" className="inline-flex items-center gap-2 mt-6 text-indigo-600 font-semibold hover:text-indigo-700">Go practice <ArrowRight className="w-4 h-4" /></Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  <th className="p-6">Subject</th>
                                  <th className="p-6">Topic</th>
                                  <th className="p-6 text-center">Wrong / Total</th>
                                  <th className="p-6">Accuracy</th>
                                  <th className="p-6 text-right">Action</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {mistakes.map((m, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="p-6 font-medium text-slate-800">
                                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                                              m.subject === 'Physics' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                              m.subject === 'Chemistry' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          }`}>
                                              {m.subject}
                                          </span>
                                      </td>
                                      <td className="p-6 text-sm font-semibold text-slate-700">{m.topicName}</td>
                                      <td className="p-6 text-center">
                                          <span className="inline-flex items-center gap-1 text-sm text-slate-700 font-medium">
                                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-sm">
                                                  {m.wrongCount}
                                              </span>
                                              <span className="text-slate-400">/ {m.totalAttempts}</span>
                                          </span>
                                      </td>
                                      <td className="p-6">
                                         <div className="flex items-center gap-3">
                                             <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden max-w-[120px]">
                                                <div className={`h-full rounded-full ${m.accuracy > 70 ? 'bg-emerald-500' : m.accuracy > 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${m.accuracy}%` }}></div>
                                             </div>
                                             <span className="text-xs font-bold text-slate-600 w-8">{m.accuracy}%</span>
                                         </div>
                                      </td>
                                      <td className="p-6 text-right">
                                          <button 
                                              onClick={() => router.push(`/exam/setup?subject=${m.subjectId}&topic=${encodeURIComponent(m.topicName)}`)}
                                              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center justify-end gap-1 ml-auto"
                                          >
                                              Practice Topic <ArrowRight className="w-4 h-4" />
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                           </tbody>
                        </table>
                    </div>
                )}
            </div>
            
        </div>
    );
}
