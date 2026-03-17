'use client'

import { Flag, CheckCircle2 } from "lucide-react";

interface QuestionNavigatorProps {
  totalCount: number;
  currentIndex: number;
  answers: Record<string, string | null>; // id -> answer
  flags: Record<string, boolean>;         // id -> isFlagged
  questionIds: string[];
  onSelect: (index: number) => void;
}

export function QuestionNavigator({ 
  totalCount, 
  currentIndex, 
  answers, 
  flags, 
  questionIds, 
  onSelect 
}: QuestionNavigatorProps) {
  
  return (
    <div className="bg-white border text-center border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-full max-h-[calc(100vh-120px)] overflow-hidden">
      <div className="font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Question Navigator</div>
      
      <div className="grid grid-cols-5 gap-2 overflow-y-auto pr-2 pb-4 flex-1">
        {Array.from({ length: totalCount }).map((_, i) => {
          const qId = questionIds[i];
          const isCurrent = currentIndex === i;
          const isAnswered = qId && answers[qId] !== null && answers[qId] !== undefined;
          const isFlagged = qId && flags[qId];

          let bgClass = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"; // Default (unseen/skipped)
          if (isCurrent) bgClass = "bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-200 ring-offset-1";
          else if (isFlagged) bgClass = "bg-amber-100 border-amber-300 text-amber-800";
          else if (isAnswered) bgClass = "bg-emerald-100 border-emerald-300 text-emerald-800";

          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg border text-sm font-medium transition-all ${bgClass} relative`}
            >
              {isAnswered && !isCurrent && <CheckCircle2 className="w-3 h-3 absolute -top-1 -right-1 text-emerald-600 fill-white rounded-full bg-white" />}
              {isFlagged && !isCurrent && <Flag className="w-3 h-3 absolute -top-1 -right-1 text-amber-500 fill-amber-500 bg-white rounded-full p-[1px]" />}
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
         <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded-sm"></div> Answered</div>
         <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-amber-100 border border-amber-300 rounded-sm"></div> Flagged</div>
         <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-white border border-slate-200 rounded-sm"></div> Not visited</div>
         <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-indigo-600 rounded-sm text-white"></div> Current</div>
      </div>
    </div>
  );
}
