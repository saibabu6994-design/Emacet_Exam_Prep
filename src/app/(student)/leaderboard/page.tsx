'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Trophy, Medal, Star, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type LeaderboardEntry = {
  id: string;
  rank: number;
  name: string;
  exam: string;
  avgScore: number;
  testsTaken: number;
  isCurrentUser?: boolean;
};

export default function LeaderboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace('/login'); return; }

        // students.id = auth.user.id — use directly
        const currentStudentId = user.id;

        const { data: students } = await supabase
          .from('students')
          .select('id, full_name, target_exam');

        const { data: sessions } = await supabase
          .from('exam_sessions')
          .select('student_id, score, max_score')
          .eq('status', 'submitted');

        if (students && sessions) {
          const studentStats: Record<string, { totScore: number; totMax: number; count: number; name: string; exam: string }> = {};

          students.forEach(s => {
            studentStats[s.id] = {
              totScore: 0, totMax: 0, count: 0,
              name: s.full_name.split(' ')[0],
              exam: s.target_exam || 'EAMCET',
            };
          });

          sessions.forEach(s => {
            if (studentStats[s.student_id]) {
              studentStats[s.student_id].totScore += (s.score || 0);
              studentStats[s.student_id].totMax += (s.max_score || 0);
              studentStats[s.student_id].count += 1;
            }
          });

          const leaderboard = Object.keys(studentStats)
            .filter(id => studentStats[id].count > 0)
            .map(id => {
              const st = studentStats[id];
              const pct = st.totMax > 0 ? (st.totScore / st.totMax) * 100 : 0;
              return {
                id,
                name: st.name,
                exam: st.exam,
                avgScore: Math.round(pct),
                testsTaken: st.count,
                isCurrentUser: id === currentStudentId,
              };
            })
            .sort((a, b) => b.avgScore - a.avgScore)
            .map((entry, index) => ({ ...entry, rank: index + 1 }));

          setLeaders(leaderboard);
        }

      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="p-10 flex justify-center items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Compiling ranks...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 border-4 border-amber-50 shadow-sm">
          <Trophy className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Global Leaderboard</h1>
        <p className="text-slate-500">Ranked by overall accuracy across all mock exams.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
        
        <div className="overflow-x-auto mt-1.5">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <th className="p-5 w-20 text-center">Rank</th>
                <th className="p-5">Student</th>
                <th className="p-5 hidden sm:table-cell">Target</th>
                <th className="p-5 text-center">Exams</th>
                <th className="p-5 text-right pr-8">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500">
                    Not enough data yet. Take some exams to appear here!
                  </td>
                </tr>
              ) : (
                leaders.map(leader => {
                  const isTop3 = leader.rank <= 3;
                  return (
                    <tr
                      key={leader.rank}
                      className={`hover:bg-slate-50 transition-colors ${leader.isCurrentUser ? 'bg-indigo-50/60 hover:bg-indigo-50' : ''}`}
                    >
                      <td className="p-5 text-center">
                        {leader.rank === 1 ? <Medal className="w-8 h-8 text-amber-400 mx-auto drop-shadow-sm" /> :
                         leader.rank === 2 ? <Medal className="w-7 h-7 text-slate-400 mx-auto" /> :
                         leader.rank === 3 ? <Medal className="w-7 h-7 text-amber-600 mx-auto" /> :
                         <span className="font-bold text-slate-400 text-lg">#{leader.rank}</span>}
                      </td>
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-base
                            ${isTop3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}
                            ${leader.isCurrentUser ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
                          `}>
                            {leader.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={`font-bold text-sm ${leader.isCurrentUser ? 'text-indigo-700' : 'text-slate-800'}`}>
                              {leader.name} {leader.isCurrentUser && <span className="text-xs font-normal text-indigo-400 ml-1">(You)</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 hidden sm:table-cell">
                        <span className="inline-flex px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs font-semibold uppercase">
                          {leader.exam}
                        </span>
                      </td>
                      <td className="p-5 text-center font-medium text-slate-600 text-sm">{leader.testsTaken}</td>
                      <td className="p-5 text-right pr-8">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-black text-xl tracking-tight ${isTop3 ? 'text-amber-600' : 'text-slate-700'}`}>
                            {leader.avgScore}%
                          </span>
                          {isTop3 && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
