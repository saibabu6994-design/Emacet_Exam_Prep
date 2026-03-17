'use client'

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Plus, Trash2, Edit2, Zap, Search, Filter } from "lucide-react";
import toast from "react-hot-toast";

type Question = {
  id: string;
  subject_id: number;
  topic_id: number;
  question_text: string;
  difficulty: string;
  source: string;
  year: number;
};

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Generation state
  const [generateSubject, setGenerateSubject] = useState("1");
  const [generateTopic, setGenerateTopic] = useState("1");
  const [topicName, setTopicName] = useState("Laws of Motion");
  const [generateCount, setGenerateCount] = useState("5");

  const supabase = createClient();

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject_id, topic_id, question_text, difficulty, source, year')
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (error) {
      toast.error("Failed to load questions");
    } else {
      setQuestions(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    
    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Question deleted");
      setQuestions(q => q.filter(x => x.id !== id));
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      toast.loading("Gemini is generating questions...", { id: 'gen' });

      // In a real app we would fetch the subject name from DB based on ID.
      const subjectName = "Physics"; // Placeholder mapping for MVP

      const res = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_name: topicName,
          subject_name: subjectName,
          count: parseInt(generateCount),
          difficulty: "medium",
          source_contexts: [] // We could fetch recently uploaded docs for this subject
        })
      });

      if (!res.ok) throw new Error("Failed to generate");

      const { questions: generatedQs } = await res.json();
      
      // Save directly to DB
      const inserts = generatedQs.map((q: any) => ({
        ...q,
        subject_id: parseInt(generateSubject),
        topic_id: parseInt(generateTopic),
        source: 'ai_generated',
      }));

      const { data, error } = await supabase.from('questions').insert(inserts).select();

      if (error) throw error;

      toast.success(`Generated ${generatedQs.length} questions!`, { id: 'gen' });
      
      if (data) {
          setQuestions(prev => [...data, ...prev]);
      } else {
          fetchQuestions();
      }

    } catch (e: any) {
      toast.error(e.message || "An error occurred", { id: 'gen' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Question Bank</h1>
          <p className="text-sm text-slate-500 mt-1">Manage and generate exam questions.</p>
        </div>
      </div>

      {/* Generation Panel */}
      <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-xl flex flex-col md:flex-row gap-4 items-end">
         <div className="flex-1 space-y-1 w-full">
            <label className="text-xs font-semibold text-indigo-800 uppercase">Subject ID</label>
            <input type="number" value={generateSubject} onChange={e => setGenerateSubject(e.target.value)} className="w-full p-2 rounded-md border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" />
         </div>
         <div className="flex-1 space-y-1 w-full">
            <label className="text-xs font-semibold text-indigo-800 uppercase">Topic ID</label>
            <input type="number" value={generateTopic} onChange={e => setGenerateTopic(e.target.value)} className="w-full p-2 rounded-md border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" />
         </div>
         <div className="flex-[2] space-y-1 w-full">
            <label className="text-xs font-semibold text-indigo-800 uppercase">Topic Name (for AI)</label>
            <input type="text" value={topicName} onChange={e => setTopicName(e.target.value)} className="w-full p-2 rounded-md border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500" />
         </div>
         <div className="flex-1 space-y-1 w-full">
            <label className="text-xs font-semibold text-indigo-800 uppercase">Count</label>
            <select value={generateCount} onChange={e => setGenerateCount(e.target.value)} className="w-full p-2 rounded-md border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-500">
               <option value="5">5</option>
               <option value="10">10</option>
               <option value="20">20</option>
            </select>
         </div>
         <button 
           onClick={handleGenerate} 
           disabled={generating}
           className="px-6 py-2.5 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition flex items-center justify-center gap-2 w-full md:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
         >
            {generating ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : <Zap className="w-5 h-5" />}
            Generate More
         </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50">
           <div className="relative max-w-sm w-full">
             <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input type="text" placeholder="Search questions..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
           </div>
           <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              <Filter className="w-4 h-4" />
              Filter
           </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="p-4 font-medium">Question</th>
                <th className="p-4 font-medium hidden md:table-cell">Subject</th>
                <th className="p-4 font-medium hidden sm:table-cell">Difficulty</th>
                <th className="p-4 font-medium">Source</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={5} className="p-8 text-center text-slate-500">Loading questions...</td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                   <td colSpan={5} className="p-8 text-center text-slate-500">No questions found. Try generating some!</td>
                </tr>
              ) : (
                questions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 group">
                    <td className="p-4 text-sm text-slate-800 line-clamp-2 max-w-sm">
                      {q.question_text}
                    </td>
                    <td className="p-4 text-sm text-slate-600 hidden md:table-cell">ID: {q.subject_id}</td>
                    <td className="p-4 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium 
                        ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 
                          q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'}`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="p-4">
                       <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium 
                        ${q.source === 'ai_generated' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                        {q.source === 'ai_generated' ? 'AI Generated' : 'Past Paper'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                       <button className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md transition opacity-0 group-hover:opacity-100">
                          <Edit2 className="w-4 h-4" />
                       </button>
                       <button onClick={() => handleDelete(q.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                       </button>
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
