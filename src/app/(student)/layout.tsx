import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { StudentNav } from "@/components/nav/StudentNav";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <StudentNav />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen md:min-h-0 overflow-auto pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
