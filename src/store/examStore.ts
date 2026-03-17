import { create } from 'zustand'

interface ExamState {
  currentSessionId: string | null;
  setCurrentSession: (id: string | null) => void;
}

const useStore = create<ExamState>((set) => ({
  currentSessionId: null,
  setCurrentSession: (id) => set({ currentSessionId: id }),
}))

export default useStore;
