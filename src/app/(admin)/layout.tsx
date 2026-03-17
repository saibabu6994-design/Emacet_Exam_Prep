import Link from "next/link";
import { LogOut, UploadCloud, FileText, Users, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:block">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="text-xl font-bold text-indigo-600">TS EXAMprep Admin</span>
        </div>
        <nav className="p-4 space-y-2">
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-md">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link href="/admin/upload" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-md">
            <UploadCloud className="w-5 h-5" />
            Upload Sources
          </Link>
          <Link href="/admin/questions" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-md">
            <FileText className="w-5 h-5" />
            Question Bank
          </Link>
          <Link href="/admin/students" className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-md">
            <Users className="w-5 h-5" />
            Students
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <h2 className="text-lg font-medium text-slate-800">Admin Panel</h2>
          <SignOutButton />
        </div>
        <div className="p-6 flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
