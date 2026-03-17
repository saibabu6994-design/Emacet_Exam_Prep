'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { History, Eye, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function ExamHistoryPage() {
    const supabase = createClient();
    const router = useRouter();
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return router.replace('/login');

                const { data: examSessions, error } = await supabase
                    .from('exam_sessions')
                    .select('*')
                    .eq('student_id', user.id)
                    .order('started_at', { ascending: false });
                    
                if (error) throw error;
                
                setSessions(examSessions || []);
            } catch (err: any) {
                toast.error("Failed to load history.");
            } finally {
                setLoading(false);
            }
        }
        
        fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-500">Loading exam history...</div>

    return (
        <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                   <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Exam History</h1>
                   <p className="text-slate-500 mt-2">View all your past practice sessions and detailed results.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                     <History className="w-5 h-5 text-indigo-500" />
                     <h2 className="font-semibold text-slate-800">All Sessions</h2>
                </div>

                {sessions.length === 0 ? (
                    <div className="p-16 text-center text-slate-500">
                        No previous exams found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                  <th className="p-6">Date</th>
                                  <th className="p-6">Type</th>
                                  <th className="p-6">Status</th>
                                  <th className="p-6">Score</th>
                                  <th className="p-6">Time Taken</th>
                                  <th className="p-6 text-right">Action</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {sessions.map((session) => {
                                  const timeTakenMs = session.submitted_at 
                                      ? new Date(session.submitted_at).getTime() - new Date(session.started_at).getTime() 
                                      : 0;
                                  const m = Math.floor(timeTakenMs / 60000);
                                  const s = Math.floor((timeTakenMs % 60000) / 1000);
                                  
                                  const isCompleted = session.status === 'submitted';

                                  // Safe date formatting — use started_at (not created_at which doesn't exist)
                                  const dateStr = session.started_at
                                      ? new Date(session.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                                      : '—';

                                  return (
                                  <tr key={session.id} className="hover:bg-slate-50">
                                      <td className="p-6 font-medium text-slate-800">
                                           {dateStr}
                                      </td>
                                      <td className="p-6">
                                          <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                                              session.exam_type === 'practice' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                              session.exam_type === 'mistake_drill' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                              'bg-slate-50 text-slate-700 border-slate-200'
                                          }`}>
                                              {session.exam_type.replace('_', ' ')}
                                          </span>
                                      </td>
                                      <td className="p-6 text-sm">
                                          <div className="flex items-center gap-2">
                                          {isCompleted ? (
                                              <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> <span className="text-emerald-700 font-medium">Completed</span></>
                                          ) : (
                                              <><XCircle className="w-4 h-4 text-amber-500" /> <span className="text-amber-700 font-medium">In Progress</span></>
                                          )}
                                          </div>
                                      </td>
                                      <td className="p-6 font-bold text-slate-800">
                                          {isCompleted ? (
                                              <>{session.score} <span className="text-slate-400 font-normal text-xs">/ {session.max_score}</span></>
                                          ) : '-'}
                                      </td>
                                      <td className="p-6 text-slate-600 text-sm font-medium">
                                          {isCompleted ? `${m}m ${s}s` : '-'}
                                      </td>
                                      <td className="p-6 text-right">
                                          {isCompleted ? (
                                              <Link href={`/exam/results/${session.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
                                                  <Eye className="w-4 h-4" /> View Results
                                              </Link>
                                          ) : (
                                              (() => {
                                                  const isExpired = session.started_at && 
                                                      (new Date().getTime() - new Date(session.started_at).getTime()) > (session.time_limit_minutes + 30) * 60 * 1000;
                                                  
                                                  if (isExpired) {
                                                      return (
                                                          <span className="inline-flex px-3 py-1 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg text-xs font-semibold uppercase tracking-wider italic">
                                                              Expired
                                                          </span>
                                                      );
                                                  }
                                                  
                                                  return (
                                                      <Link href={`/exam/${session.id}`} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
                                                          Resume Exam
                                                      </Link>
                                                  );
                                              })()
                                          )}
                                      </td>
                                  </tr>
                              )})}
                           </tbody>
                        </table>
                    </div>
                )}
            </div>
            
        </div>
    );
}
