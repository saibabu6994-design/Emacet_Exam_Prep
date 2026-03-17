import { Question } from '@/types';
import { Flag, Check, X } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface QuestionCardProps {
  question: Question;
  currentIndex: number;
  totalQuestions: number;
  selectedAnswer: string | null;
  onSelectAnswer: (answer: string) => void;
  isFlagged: boolean;
  onToggleFlag: () => void;
  // Post-submit props
  isReviewMode?: boolean;
  correctAnswer?: string;
}

// Helper to render KaTeX math expressions mixed with text
function MathText({ content }: { content: string }) {
  if (!content) return null;
  
  // Split by $$...$$ block math and $...$ inline math
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  
  return (
    <span className="break-words">
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={index} math={part.slice(2, -2)} />;
        } else if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={index} math={part.slice(1, -1)} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

export function QuestionCard({
  question,
  currentIndex,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  isFlagged,
  onToggleFlag,
  isReviewMode = false,
  correctAnswer,
}: QuestionCardProps) {

  const options = [
    { key: 'A', value: question.option_a },
    { key: 'B', value: question.option_b },
    { key: 'C', value: question.option_c },
    { key: 'D', value: question.option_d }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[calc(100vh-120px)]">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl shrink-0">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-base font-semibold rounded-lg border border-indigo-200">
            Q {currentIndex + 1} / {totalQuestions}
          </span>
          {isReviewMode && (
             <span className="px-3 py-1 bg-slate-100 text-slate-600 text-base font-medium rounded-lg border border-slate-200">
                Review Mode
             </span>
          )}
        </div>
        
        {!isReviewMode && (
          <button
            onClick={onToggleFlag}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-base font-medium transition-colors border ${
              isFlagged 
                ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
            {isFlagged ? 'Flagged' : 'Flag for review'}
          </button>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="text-lg md:text-xl text-slate-800 font-medium mb-8 leading-relaxed min-text-[16px]">
          <MathText content={question.question_text} />
        </div>

        <div className="space-y-4 max-w-3xl">
          {options.map((opt) => {
            const isSelected = selectedAnswer === opt.key;
            const isCorrect = isReviewMode && correctAnswer === opt.key;
            const isWrongSelected = isReviewMode && isSelected && correctAnswer !== opt.key;
            
            let btnClass = "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-700";
            
            if (!isReviewMode && isSelected) {
              btnClass = "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600 shadow-sm";
            } else if (isReviewMode) {
              if (isCorrect) {
                btnClass = "border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500 shadow-sm";
              } else if (isWrongSelected) {
                btnClass = "border-red-500 bg-red-50 text-red-900 ring-1 ring-red-500 opacity-90";
              } else {
                btnClass = "border-slate-200 bg-slate-50/50 text-slate-400 cursor-default opacity-50"; // Dim non-selected wrong answers
              }
            }

            return (
              <button
                key={opt.key}
                disabled={isReviewMode}
                onClick={() => onSelectAnswer(opt.key)}
                className={`w-full p-4 rounded-xl border-2 transition-all flex items-start gap-4 text-left group ${btnClass}`}
              >
                <div className={`
                  w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold shrink-0 text-base mt-0.5
                  ${!isReviewMode && isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : ''}
                  ${!isReviewMode && !isSelected ? 'border-slate-300 text-slate-500 group-hover:border-indigo-400 group-hover:text-indigo-600' : ''}
                  ${isReviewMode && isCorrect ? 'bg-emerald-600 border-emerald-600 text-white' : ''}
                  ${isReviewMode && isWrongSelected ? 'bg-red-600 border-red-600 text-white' : ''}
                  ${isReviewMode && !isCorrect && !isWrongSelected ? 'border-slate-300 text-slate-400 bg-slate-100' : ''}
                `}>
                  {isReviewMode && isCorrect ? <Check className="w-5 h-5" /> : isReviewMode && isWrongSelected ? <X className="w-5 h-5" /> : opt.key}
                </div>
                <div className="text-base sm:text-lg flex-1 leading-snug break-words">
                  <MathText content={opt.value} />
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Explanation section for review mode */}
        {isReviewMode && (question.explanation || question.shortcut_tip) && (
            <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
               {question.explanation && (
                 <div>
                    <h4 className="text-base font-bold text-slate-700 uppercase tracking-widest mb-2">Explanation</h4>
                    <p className="text-base text-slate-600 whitespace-pre-wrap"><MathText content={question.explanation} /></p>
                 </div>
               )}
               {question.shortcut_tip && (
                 <div className="pt-4 border-t border-slate-200">
                    <h4 className="text-base font-bold text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Shortcut Tip</h4>
                    <p className="text-base text-slate-600 italic"><MathText content={question.shortcut_tip} /></p>
                 </div>
               )}
            </div>
        )}
      </div>
    </div>
  );
}
