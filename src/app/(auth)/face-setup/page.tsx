"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import FaceCapture from "@/components/auth/FaceCapture";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function FaceSetupPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router, supabase.auth]);

  const handleCaptureSuccess = async (descriptor: Float32Array) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert Float32Array to standard array for Supabase FLOAT8[]
      const descriptorArray = Array.from(descriptor);

      const { error } = await supabase
        .from('students')
        .update({ face_descriptor: descriptorArray })
        .eq('id', user.id);

      if (error) throw error;

      toast.success("Face registered successfully!");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to save face descriptor");
    }
  };

  const handleSkip = () => {
    toast("You can always set this up later.")
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-sm rounded-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight text-center">Face Authentication Setup</CardTitle>
          <CardDescription className="text-center">
            This secures your exams and prevents proxy test-taking.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FaceCapture onCaptureSuccess={handleCaptureSuccess} onSkip={handleSkip} />
        </CardContent>
      </Card>
    </div>
  );
}
