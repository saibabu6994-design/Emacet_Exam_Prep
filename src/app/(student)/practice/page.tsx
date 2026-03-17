import Link from "next/link";
import { BookOpen, ChevronRight, Atom, FlaskConical, Calculator } from "lucide-react";

const SUBJECTS = [
  {
    id: 1,
    name: "Physics",
    icon: Atom,
    color: "from-indigo-500 to-indigo-600",
    borderColor: "border-indigo-200",
    topics: ["Laws of Motion", "Work, Energy & Power", "Gravitation", "Waves & Optics", "Electrostatics", "Current Electricity", "Magnetism", "Modern Physics"],
  },
  {
    id: 2,
    name: "Chemistry",
    icon: FlaskConical,
    color: "from-amber-500 to-amber-600",
    borderColor: "border-amber-200",
    topics: ["Atomic Structure", "Chemical Bonding", "Organic Chemistry", "Thermodynamics", "Equilibrium", "Electrochemistry", "Coordination Compounds", "p-Block Elements"],
  },
  {
    id: 3,
    name: "Mathematics",
    icon: Calculator,
    color: "from-emerald-500 to-emerald-600",
    borderColor: "border-emerald-200",
    topics: ["Algebra", "Calculus", "Coordinate Geometry", "Trigonometry", "Probability & Statistics", "Vectors & 3D", "Differential Equations", "Matrices"],
  },
];

export default function PracticePage() {
  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Topic Practice</h1>
        <p className="text-slate-500 mt-2">Select a subject and topic to start focused practice.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SUBJECTS.map(subject => (
          <div key={subject.id} className={`bg-white rounded-2xl border ${subject.borderColor} shadow-sm overflow-hidden`}>
            {/* Subject Header */}
            <div className={`bg-gradient-to-br ${subject.color} p-6 text-white`}>
              <subject.icon className="w-8 h-8 mb-3 opacity-90" />
              <h2 className="text-xl font-bold">{subject.name}</h2>
              <p className="text-sm opacity-80 mt-1">{subject.topics.length} topics</p>
            </div>

            {/* Topic List */}
            <div className="p-4 space-y-1">
              {subject.topics.map((topic, i) => (
                <Link
                  key={i}
                  href={`/exam/setup?subject=${subject.id}&topic=${encodeURIComponent(topic)}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 group transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-indigo-500 transition-colors" />
                    <span className="text-sm font-medium">{topic}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Start */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold mb-2">Ready for a Full Mock?</h3>
          <p className="text-indigo-200 text-sm">Test yourself with a complete TS EAMCET simulation — 160 questions, 3 hours.</p>
        </div>
        <Link
          href="/exam/setup"
          className="shrink-0 px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition flex items-center gap-2"
        >
          <BookOpen className="w-5 h-5" />
          Configure Exam
        </Link>
      </div>
    </div>
  );
}
