import { createClient } from "@/lib/supabase-server";
import { Activity, Target, BookOpen, AlertCircle, ArrowRight, TrendingUp, Flame } from "lucide-react";
import Link from "next/link";
import { SUBJECT_NAMES, TOPIC_NAMES } from "@/types";

export default async function StudentDashboardPage() {
  const supabase = createClient();
  // Middleware already ensures a valid session exists — use getSession (no extra network call)
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  // 1. Parallel Fetch: student and sessions
  const [studentRes, sessionsRes] = await Promise.all([
    supabase.from('students').select('*').eq('id', userId).single(),
    supabase.from('exam_sessions')
      .select('id, score, max_score, started_at, submitted_at, status')
      .eq('student_id', userId)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true })
  ]);

  const student = studentRes.data;
  const sessions = sessionsRes.data;

  // Fallback: use email from session if student row not yet created  
  const studentName = student?.full_name ?? session?.user?.email?.split('@')[0] ?? 'Student';
  const studentId = student?.id ?? userId;

  const totalExams = sessions?.length || 0;
  const recentSessions = [...(sessions || [])].reverse().slice(0, 5);

  // Calculate overall stats
  let totalScore = 0, totalMax = 0;
  sessions?.forEach(s => {
    totalScore += (s.score || 0);
    totalMax += (s.max_score || 0);
  });
  const avgAccuracy = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  // Calculate streak (consecutive days with submitted sessions)
  let streak = 0;
  if (sessions && sessions.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionDates = new Set(
      sessions.map(s => {
        const d = new Date(s.submitted_at || s.started_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );
    const DAY_MS = 86400000;
    let checkDay = today.getTime();
    // Check today or yesterday first
    while (sessionDates.has(checkDay) || (streak === 0 && sessionDates.has(checkDay - DAY_MS))) {
      if (sessionDates.has(checkDay)) {
        streak++;
        checkDay -= DAY_MS;
      } else {
        checkDay -= DAY_MS;
        if (sessionDates.has(checkDay)) {
          streak++;
          checkDay -= DAY_MS;
        } else break;
      }
    }
  }

  // 2. Fetch real weak topics from question_attempts → questions
  const { data: wrongAttempts } = await supabase
    .from('question_attempts')
    .select('question_id, questions(subject_id, topic_id)')
    .eq('student_id', userId)
    .eq('is_correct', false)
    .limit(100);

  const topicCounts: Record<string, { subject: string; count: number }> = {};
  (wrongAttempts || []).forEach((a: any) => {
    const subjectId = a.questions?.subject_id || 1;
    const topicId = a.questions?.topic_id || 0;
    const key = `${subjectId}-${topicId}`;
    if (!topicCounts[key]) {
      topicCounts[key] = { subject: SUBJECT_NAMES[subjectId] || 'Unknown', count: 0 };
    }
    topicCounts[key].count++;
  });

  const weakTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)
    .map(([key, val]) => {
      const [subjectId, topicId] = key.split('-');
      return { subject: val.subject, subjectId: Number(subjectId), topicId, wrongCount: val.count };
    });

  // Score chart data (last 8 sessions)
  const chartSessions = [...(sessions || [])].reverse().slice(0, 8).reverse();

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Welcome back, {studentName.split(' ')[0]}! 👋
          </h1>
          <p className="text-slate-500 mt-1">
            Target: <span className="font-semibold text-indigo-600">{student?.target_exam || 'EAMCET'}</span>
            {streak > 0 && <span className="ml-3 text-amber-600 font-medium">🔥 {streak}-day streak</span>}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
          <div className="flex justify-between items-start mb-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Accuracy</div>
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-4xl font-black text-slate-800">{avgAccuracy}%</div>
          <div className="text-xs text-slate-400 mt-2">Across all exams</div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-indigo-500">
          <div className="flex justify-between items-start mb-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Exams Taken</div>
            <Activity className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-4xl font-black text-slate-800">{totalExams}</div>
          <div className="text-xs text-slate-400 mt-2">Completed sessions</div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm border-t-4 border-t-amber-500">
          <div className="flex justify-between items-start mb-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Study Streak</div>
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-4xl font-black text-slate-800">
            {streak}<span className="text-xl text-slate-400 font-medium"> days</span>
          </div>
          <div className="text-xs text-amber-600 mt-2 font-medium">{streak > 0 ? 'Keep it up!' : 'Start today!'}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col border border-slate-200">
          <div className="p-5 sm:p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 flex-1 flex flex-col justify-center text-white relative">
            <BookOpen className="w-12 h-12 text-indigo-400/30 absolute right-4 bottom-4" />
            <h3 className="font-bold text-lg mb-1 relative z-10">Ready to practice?</h3>
            <p className="text-indigo-100 text-xs relative z-10 mb-4">Take a timed mock to sharpen your skills.</p>
            <Link href="/exam/setup" className="inline-flex w-fit items-center gap-2 px-4 py-2 bg-white text-indigo-700 font-semibold rounded-lg text-sm hover:bg-indigo-50 transition-colors z-10">
              Start Exam <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Sessions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
            <Link href="/history" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View all →</Link>
          </div>

          {recentSessions.length === 0 ? (
            <div className="bg-slate-50 rounded-xl p-10 border border-slate-200 border-dashed text-center text-slate-500">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>No exams yet. Start your first practice session!</p>
              <Link href="/exam/setup" className="inline-flex items-center gap-2 mt-4 text-indigo-600 font-semibold hover:text-indigo-700">
                Start Exam <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="p-4">Date</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Accuracy</th>
                    <th className="p-4 text-right">Results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSessions.map((session, i) => {
                    const acc = session.max_score > 0 ? Math.round((session.score / session.max_score) * 100) : 0;
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 text-sm text-slate-700 font-medium">
                          {new Date(session.submitted_at || session.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="p-4 text-sm font-bold text-indigo-600">
                          {session.score} <span className="text-slate-400 text-xs font-normal">/ {session.max_score}</span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${acc > 70 ? 'bg-emerald-500' : acc > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${acc}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-600">{acc}%</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <Link href={`/exam/results/${session.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            Review →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Simple Score Trend */}
          {chartSessions.length > 1 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-slate-800">Score Trend</h3>
              </div>
              <div className="flex items-end gap-2 h-24">
                {chartSessions.map((s, i) => {
                  const pct = s.max_score > 0 ? (s.score / s.max_score) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t-sm transition-all ${pct > 70 ? 'bg-emerald-400' : pct > 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ height: `${Math.max(8, pct)}%` }}
                        title={`${Math.round(pct)}%`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400">Oldest</span>
                <span className="text-xs text-slate-400">Latest</span>
              </div>
            </div>
          )}
        </div>

        {/* Weak Areas */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Focus Areas</h2>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2.5 bg-red-50 text-red-500 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Top Weak Areas</h3>
                <p className="text-xs text-slate-500 mt-0.5">Based on your wrong answers</p>
              </div>
            </div>

            {weakTopics.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-sm">
                {totalExams === 0 ? 'Take an exam to see your weak areas.' : '🎉 Looking great! No obvious weaknesses.'}
              </div>
            ) : (
              <div className="space-y-3 mb-5">
                {weakTopics.map((wt, i) => (
                  <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 last:border-0">
                    <div>
                      <span className="font-medium text-slate-700">{wt.subject}</span>
                      {wt.topicId !== '0' && (
                        <span className="text-xs text-slate-400 ml-1">
                          {TOPIC_NAMES[wt.subjectId]?.[Number(wt.topicId)] ?? `Topic ${wt.topicId}`}
                        </span>
                      )}
                    </div>
                    <span className="text-red-500 font-bold text-xs">{wt.wrongCount} wrong</span>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/mistakes"
              className="block w-full text-center py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-lg border border-slate-200 transition-colors"
            >
              Review Mistake Drill →
            </Link>
          </div>

          {/* Quick Links */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">Quick Links</h3>
            {[
              { href: '/history', label: 'Exam History' },
              { href: '/leaderboard', label: 'Leaderboard' },
              { href: '/exam/setup', label: 'New Practice Exam' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between text-sm font-medium text-slate-600 hover:text-indigo-600 py-1.5 transition-colors"
              >
                {link.label} <ArrowRight className="w-4 h-4" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
