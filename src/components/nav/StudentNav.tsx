'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, AlertCircle, History, Trophy, LayoutDashboard, GraduationCap, PenSquare } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'hover:bg-indigo-50 hover:text-indigo-700', activeColor: 'bg-indigo-50 text-indigo-700' },
  { href: '/exam/setup', label: 'New Exam', icon: PenSquare, color: 'hover:bg-indigo-50 hover:text-indigo-700', activeColor: 'bg-indigo-50 text-indigo-700' },
  { href: '/practice', label: 'Practice by Topic', icon: BookOpen, color: 'hover:bg-emerald-50 hover:text-emerald-700', activeColor: 'bg-emerald-50 text-emerald-700' },
  { href: '/mistakes', label: 'Mistake Review', icon: AlertCircle, color: 'hover:bg-rose-50 hover:text-rose-600', activeColor: 'bg-rose-50 text-rose-600' },
  { href: '/history', label: 'Exam History', icon: History, color: 'hover:bg-slate-100 hover:text-slate-800', activeColor: 'bg-slate-100 text-slate-800' },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy, color: 'hover:bg-amber-50 hover:text-amber-700', activeColor: 'bg-amber-50 text-amber-700' },
];

export function StudentNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar — Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-800 tracking-tight">TS EXAMprep</span>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-sm
                  ${isActive ? item.activeColor + ' font-semibold' : 'text-slate-600 ' + item.color}
                `}
              >
                <item.icon className="w-4.5 h-4.5 w-[18px] h-[18px] shrink-0" />
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current opacity-60" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <SignOutButton />
        </div>
      </aside>

      {/* Bottom nav — Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex items-center justify-around px-1 py-2">
        {NAV_ITEMS.slice(0, 5).map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors
                ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold leading-tight">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
