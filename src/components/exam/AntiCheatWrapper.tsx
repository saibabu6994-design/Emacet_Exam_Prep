'use client'

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';

interface AntiCheatWrapperProps {
  children: React.ReactNode;
  sessionId: string;
  onAutoSubmit: (reason: string) => void;
}

export function AntiCheatWrapper({ children, sessionId, onAutoSubmit }: AntiCheatWrapperProps) {
  const supabase = createClient();

  useEffect(() => {
    // 1. Request fullscreen automatically when component mounts
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.error('Fullscreen error:', err);
      }
    };
    enterFullscreen();

    // 2. Tab/Window Switch Detection
    // Use a ref-like variable captured in closure to avoid adding it to deps
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Fetch the current count from DB, increment, then update
        const { data } = await supabase
          .from('exam_sessions')
          .select('tab_switch_warnings')
          .eq('id', sessionId)
          .single();

        const currentWarnings = ((data?.tab_switch_warnings) || 0) + 1;

        await supabase
          .from('exam_sessions')
          .update({ tab_switch_warnings: currentWarnings })
          .eq('id', sessionId);

        if (currentWarnings >= 3) {
          toast.error('Exam auto-submitted due to multiple tab switches.');
          onAutoSubmit('max_warnings_exceeded');
        } else {
          alert(
            `WARNING ${currentWarnings}/3: You switched tabs! Do not leave the exam window or your exam will be auto-submitted.`
          );
        }
      }
    };

    // 3. Right-click disabled
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    // 4. Copy-paste disabled
    const handleCopy = (e: ClipboardEvent) => e.preventDefault();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);

      // Exit fullscreen if leaving
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((err) => console.error(err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, onAutoSubmit, supabase]);

  return <>{children}</>;
}
