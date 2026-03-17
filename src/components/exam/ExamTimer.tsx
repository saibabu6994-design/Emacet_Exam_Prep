'use client'

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Clock } from 'lucide-react';

interface ExamTimerProps {
  initialMinutes: number;
  sessionId: string;
  onTimeUp: () => void;
}

export function ExamTimer({ initialMinutes, sessionId, onTimeUp }: ExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(initialMinutes * 60);
  const [isWarning, setIsWarning] = useState(false);
  const [isCritical, setIsCritical] = useState(false);

  // Stable refs so interval callback can read latest values without deps
  const isWarningRef = useRef(isWarning);
  const isCriticalRef = useRef(isCritical);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => { isWarningRef.current = isWarning; }, [isWarning]);
  useEffect(() => { isCriticalRef.current = isCritical; }, [isCritical]);
  useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);

  // Crash recovery: initialise from localStorage on mount
  useEffect(() => {
    const savedTime = localStorage.getItem(`exam_time_${sessionId}`);
    if (savedTime) {
      const parsedTime = parseInt(savedTime, 10);
      if (parsedTime > 0) {
        setTimeLeft(parsedTime);
        return;
      }
    }
    setTimeLeft(initialMinutes * 60);
  }, [sessionId, initialMinutes]);

  // Watch for time-up separately so we don't add timeLeft to interval deps
  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUpRef.current();
    }
  }, [timeLeft]);

  // Stable interval — no timeLeft in deps, so it is never torn down/re-created mid-exam
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;

        // Save to localStorage every 10 seconds
        if (newTime % 10 === 0) {
          localStorage.setItem(`exam_time_${sessionId}`, newTime.toString());
        }

        // 10-minute warning
        if (newTime === 10 * 60 && !isWarningRef.current) {
          setIsWarning(true);
          toast('10 minutes remaining!', { icon: '⚠️' });
        }

        // 5-minute critical warning
        if (newTime === 5 * 60 && !isCriticalRef.current) {
          setIsCritical(true);
          toast.error('5 minutes remaining! Hurry up!');
        }

        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getTimerClasses = () => {
    if (isCritical) return 'text-red-600 bg-red-50 border-red-200 animate-pulse';
    if (isWarning) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-slate-700 bg-slate-50 border-slate-200';
  };

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${getTimerClasses()} font-mono font-bold text-lg shadow-sm transition-colors`}>
      <Clock className="w-5 h-5" />
      {formatTime(timeLeft)}
    </div>
  );
}
