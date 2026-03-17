import { createClient } from "@/lib/supabase-server";
import { Users, BookOpen, FileText, Activity, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = createClient();

  // Fetch stats in parallel
  const [
    { count: studentCount },
    { count: questionCount },
    { count: documentCount },
    { data: recentExams },
    { count: todayExams },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('questions').select('*', { count: 'exact', head: true }),
    supabase.from('source_documents').select('*', { count: 'exact', head: true }),
    supabase
      .from('exam_sessions')
      .select('id, exam_type, status, score, max_score, started_at, submitted_at, students(full_name)')
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('exam_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('started_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const stats = [
    { label: 'Total Students', value: studentCount || 0, icon: Users, color: 'border-l-indigo-600', iconColor: 'text-indigo-500' },
    { label: 'Question Bank', value: questionCount || 0, icon: BookOpen, color: 'border-l-emerald-600', iconColor: 'text-emerald-500' },
    { label: 'Source Documents', value: documentCount || 0, icon: FileText, color: 'border-l-amber-500', iconColor: 'text-amber-500' },
    { label: 'Exams Today', value: todayExams || 0, icon: Activity, color: 'border-l-rose-500', iconColor: 'text-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Platform statistics and recent activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(stat => (
          <div key={stat.label} className={`bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 ${stat.color}`}>
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</h3>
              <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
            </div>
            <p className="text-3xl font-bold text-slate-800">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Quick Admin Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/admin/upload', label: 'Upload Documents', desc: 'Add PDF question papers for AI parsing', icon: FileText },
          { href: '/admin/questions', label: 'Manage Questions', desc: 'Review, edit, and generate questions', icon: BookOpen },
          { href: '/admin/students', label: 'View Students', desc: 'Monitor student registrations', icon: Users },
        ].map(action => (
          <Link
            key={action.href}
            href={action.href}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <action.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
            </div>
            <h3 className="font-semibold text-slate-800 text-sm">{action.label}</h3>
            <p className="text-xs text-slate-400 mt-1">{action.desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent Exams Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Recent Exam Sessions</h3>
          <span className="text-xs text-slate-400">{recentExams?.length || 0} most recent</span>
        </div>

        {!recentExams || recentExams.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No exam sessions yet. Students haven't started any exams.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentExams.map((exam: any) => {
                  const acc = exam.max_score > 0 ? Math.round((exam.score / exam.max_score) * 100) : 0;
                  return (
                    <tr key={exam.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800 text-sm">
                        {exam.students?.full_name || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                          exam.exam_type === 'mistake_drill' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {exam.exam_type?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          exam.status === 'submitted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {exam.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {exam.status === 'submitted' ? (
                          <span className="text-slate-800">{exam.score} <span className="text-slate-400 font-normal">/ {exam.max_score}</span> <span className="text-xs text-slate-400">({acc}%)</span></span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(exam.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
