import { NextResponse } from "next/server";
import { createClient as createBaseClient } from "@supabase/supabase-js";

const INTERNAL_SERVICE_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const INTERNAL_SERVICE_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const { questions } = await req.json();
    
    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: "Invalid questions array" }, { status: 400 });
    }

    const supabaseService = createBaseClient(INTERNAL_SERVICE_SUPABASE_URL, INTERNAL_SERVICE_SUPABASE_KEY);

    // Filter questions that don't have a valid UUID (e.g. starting with fallback-)
    const toPersist = questions.filter(q => q.id.startsWith('fallback-'));
    
    if (toPersist.length === 0) {
      return NextResponse.json({ questions });
    }

    // Insert into DB - Use a more resilient approach
    let dbInsert = null;
    let dbErr = null;

    // First attempt: Full insert
    const firstAttempt = await supabaseService.from('questions').insert(
      toPersist.map(q => ({
        subject_id: q.subject_id,
        topic_id: q.topic_id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        shortcut_tip: q.shortcut_tip,
        difficulty: q.difficulty || 'medium',
        source: 'fallback_sync'
      }))
    ).select('id, question_text');

    if (firstAttempt.error) {
      console.warn("[SyncQuestions] Full sync failed (likely FK constraint), retrying without topic_id...", firstAttempt.error.message);
      // Second attempt: Without topic_id to ensure tracking works even if topics aren't seeded
      const secondAttempt = await supabaseService.from('questions').insert(
        toPersist.map(q => ({
          subject_id: q.subject_id,
          // Skipping topic_id
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          shortcut_tip: q.shortcut_tip,
          difficulty: q.difficulty || 'medium',
          source: 'fallback_sync'
        }))
      ).select('id, question_text');

      if (secondAttempt.error) {
        console.error("[SyncQuestions] Sync totally failed:", secondAttempt.error.message);
        return NextResponse.json({ error: secondAttempt.error.message }, { status: 500 });
      }
      dbInsert = secondAttempt.data;
    } else {
      dbInsert = firstAttempt.data;
    }

    // Map the new IDs back to the original questions
    const syncedQuestions = questions.map(q => {
      if (q.id.startsWith('fallback-')) {
        const match = dbInsert?.find(db => db.question_text.trim().toLowerCase() === q.question_text.trim().toLowerCase());
        return match ? { ...q, id: match.id } : q;
      }
      return q;
    });

    return NextResponse.json({ questions: syncedQuestions });

  } catch (error: any) {
    console.error("[SyncQuestions] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
