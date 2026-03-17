import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient as createBaseClient } from "@supabase/supabase-js";
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Use Service Role for internal DB operations in background
const INTERNAL_SERVICE_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const INTERNAL_SERVICE_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const { topic_name, subject_name, count, difficulty, source_contexts } = await req.json();
    
    // Admin uploads become the GROUNDING CONTEXT for Gemini
    const sourceText = source_contexts && source_contexts.length > 0 
      ? source_contexts.join("\n\n---\n\n") 
      : "No source context provided. Please generate standard syllabus-aligned questions.";

    const prompt = `
You are an expert TS EAMCET exam question setter for Telangana State, India.

GROUNDING CONTEXT — Use ONLY this material as your source. Do not use outside knowledge unless context is missing:
---
${sourceText}
---

Task: Generate exactly ${count} new, unique Multiple Choice Questions (MCQs) on the topic: "${topic_name}" (Subject: ${subject_name}).

Rules:
- Difficulty level: ${difficulty} (easy = direct formula application, medium = 2-step reasoning, expert = highly complex, multi-concept, requires >8 mins).
- Questions must be original but conceptually aligned with the grounding context above.
- Do NOT copy questions verbatim from the source — generate fresh variations.
- Each option must be plausible (no obviously wrong distractors).
- The shortcut_tip must be a real mathematical/conceptual trick to solve faster.
- Explanation must show step-by-step working.
- Mathematical expressions MUST be formatted in standard KaTeX using $$ for block equations and $ for inline equations (e.g., $x^2 + y^2 = r^2$).
- You must estimate realistic solve time in minutes.

Return ONLY a valid JSON array. No markdown, no explanation outside the array:
[
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "A",
    "explanation": "Step 1: ... Step 2: ... Therefore answer is A because ...",
    "shortcut_tip": "...",
    "difficulty": "${difficulty}",
    "estimated_solve_time_minutes": 5
  }
]
`;

    // Try multiple model aliases if the first one fails
    // Diagnosed available models: gemini-2.0-flash, gemini-flash-latest, gemini-2.5-flash
    const modelNames = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash"];
    let questionsArr: any[] = [];
    let generationSuccess = false;

    for (const modelName of modelNames) {
        try {
            console.log(`[AI-Gen] Attempting with model: ${modelName}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();
            questionsArr = JSON.parse(text.replace(/```json|```/g, "").trim());
            generationSuccess = true;
            break; 
        } catch (err: any) {
            console.warn(`[AI-Gen] Model ${modelName} failed: ${err.message}`);
            if (modelName === modelNames[modelNames.length - 1]) throw err;
        }
    }
    
    // If generation failed or returned 0, try to pull from local questions.json as ultimate fallback
    if (!generationSuccess || questionsArr.length === 0) {
        console.log(`[AI-Gen] AI generation failed, pulling from local fallback...`);
        try {
            const filePath = path.join(process.cwd(), 'public', 'questions.json');
            const fileData = fs.readFileSync(filePath, 'utf8');
            const allFallback = JSON.parse(fileData);
            
            // Filter by topic name if possible
            const filtered = allFallback.filter((q: any) => 
                q.topic_name === topic_name || topic_name === 'General'
            );
            
            questionsArr = filtered.slice(0, count);
        } catch (fallbackErr) {
            console.error("[AI-Gen] Local fallback also failed:", fallbackErr);
        }
    }

    if (questionsArr.length === 0) {
        throw new Error("Failed to generate or retrieve any questions.");
    }
    
    // 1. Resolve subject_id
    const subjectId = subject_name.toLowerCase().includes('chemistry') ? 2 : 
                     subject_name.toLowerCase().includes('math') ? 3 : 1;

    // 2. Insert into DB using Service Role client to bypass RLS and ensures persistence
    const supabaseService = createBaseClient(INTERNAL_SERVICE_SUPABASE_URL, INTERNAL_SERVICE_SUPABASE_KEY);
    
    const { data: dbInsert, error: dbErr } = await supabaseService.from('questions').insert(
        questionsArr.map(q => ({
            subject_id: subjectId,
            question_text: q.question_text,
            option_a: q.option_a,
            option_b: q.option_b,
            option_c: q.option_c,
            option_d: q.option_d,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            shortcut_tip: q.shortcut_tip,
            difficulty: difficulty ? difficulty.toLowerCase() : (q.difficulty || 'medium'),
            source: 'ai_generated'
        }))
    ).select('id, question_text');

    if (dbErr) {
        console.warn("Saving AI questions to DB failed:", dbErr);
    } else if (dbInsert) {
        // Update questionsArr with the new IDs by matching normalized text
        questionsArr = questionsArr.map(q => {
            const normalizedQ = q.question_text.trim().toLowerCase();
            const match = dbInsert.find(db => db.question_text.trim().toLowerCase() === normalizedQ);
            return match ? { ...q, id: match.id } : q;
        });
    }
    
    return NextResponse.json({ questions: questionsArr, count: questionsArr.length });
  } catch (error: any) {
    console.error("Generate Questions Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
