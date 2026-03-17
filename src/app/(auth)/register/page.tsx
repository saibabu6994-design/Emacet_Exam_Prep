"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [targetExam, setTargetExam] = useState("EAMCET");
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Create student record
      const { error: dbError } = await supabase.from('students').insert([
        {
          id: authData.user.id,
          email: email,
          full_name: fullName,
          phone: phone,
          target_exam: targetExam,
          last_login: new Date().toISOString()
        }
      ]);

      if (dbError) {
        toast.error("Failed to create student profile.");
        console.error(dbError);
        setLoading(false);
        return;
      }

      toast.success("Registration successful! Welcome to TS EXAMprep.");
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 py-12">
      <Card className="w-full max-w-md shadow-sm rounded-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">Create an Account</CardTitle>
          <CardDescription className="text-center">
            Join TS EXAMprep to start your practice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetExam">Target Exam</Label>
              <select 
                id="targetExam" 
                value={targetExam} 
                onChange={(e) => setTargetExam(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="EAMCET">TS EAMCET</option>
                <option value="ECET">TS ECET</option>
                <option value="POLYCET">TS POLYCET</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
              {loading ? "Creating account..." : "Register & Continue"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-500">
            Already have an account?{" "}
            <a href="/login" className="text-indigo-600 hover:underline">
              Log in
            </a>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
