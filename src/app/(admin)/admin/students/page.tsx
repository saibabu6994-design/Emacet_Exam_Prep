'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Search } from "lucide-react";
import toast from "react-hot-toast";

type Student = {
  id: string;
  full_name: string;
  email: string;
  target_exam: string;
  created_at: string;
  last_login: string;
  face_descriptor: any;
};

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      toast.error("Failed to load students");
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Students</h1>
          <p className="text-sm text-slate-500 mt-1">Manage all registered students.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
           <div className="relative max-w-sm w-full">
             <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Search students..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Target Exam</th>
                <th className="p-4 font-medium">Face Auth</th>
                <th className="p-4 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={5} className="p-8 text-center text-slate-500">Loading students...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                   <td colSpan={5} className="p-8 text-center text-slate-500">No students registered yet.</td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-4 text-sm font-medium text-slate-800">{s.full_name}</td>
                    <td className="p-4 text-sm text-slate-600">{s.email}</td>
                    <td className="p-4 text-sm">
                       <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                         {s.target_exam || 'EAMCET'}
                       </span>
                    </td>
                    <td className="p-4 text-sm">
                       {s.face_descriptor ? (
                         <span className="text-emerald-600 font-medium">Set up</span>
                       ) : (
                         <span className="text-slate-400">Pending</span>
                       )}
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
