"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    console.log("Login attempt started for:", email);

    try {
      console.log("Calling supabase.auth.signInWithPassword...");
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error("Auth error caught:", authError.message);
        toast.error(authError.message);
        setLoading(false);
        return;
      }

      console.log("Auth success! User data:", authData.user?.id);

      // Update last_login
      if (authData.user) {
        console.log("Updating last_login for user...");
        const { error: updateError } = await supabase
          .from('students')
          .update({ last_login: new Date().toISOString() })
          .eq('id', authData.user.id);
        
        if (updateError) {
          console.error("Database update error (students table):", updateError.message);
          // We continue even if update fails so the user can still log in
        } else {
          console.log("Last login updated successfully.");
        }
        
        const userEmail = authData.user.email;
        const isAdmin = userEmail === process.env.NEXT_PUBLIC_ADMIN_EMAIL || userEmail === 'saibabu6994@gmail.com';
        
        console.log("User role detected - Admin:", isAdmin);
        toast.success("Logged in successfully!");
        
        if (isAdmin) {
          console.log("Redirecting to /admin...");
          router.push("/admin");
        } else {
          console.log("Redirecting to /dashboard...");
          router.push("/dashboard");
        }
      } else {
        console.warn("Auth success but no user object returned.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Unexpected error during login flow:", err);
      toast.error("An unexpected error occurred. Please check the console.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-sm rounded-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">Login to TS EXAMprep</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m.dhoni@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-500">
            Don't have an account?{" "}
            <a href="/register" className="text-indigo-600 hover:underline">
              Register here
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
