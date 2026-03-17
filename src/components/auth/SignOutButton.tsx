'use client'

import { createClient } from '@/lib/supabase'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-2 text-slate-500 hover:text-slate-700 font-medium"
      type="button"
    >
      <LogOut className="w-4 h-4" />
      Sign Out
    </button>
  )
}
