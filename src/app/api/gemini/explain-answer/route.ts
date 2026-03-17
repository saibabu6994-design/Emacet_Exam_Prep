import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { 
        question_text, 
        options, 
        student_selected, 
        correct_answer, 
        source_contexts 
    } = await req.json();

    const sourceText = source_contexts && source_contexts.length > 0 
      ? source_contexts.join("\n\n---\n\n") 
      : "Standard physics, chemistry, and mathematics principles.";

    const prompt = `
You are a TS EAMCET expert tutor.

GROUNDING SOURCE:
---
${sourceText}
---

Question: ${question_text}
Options: A) ${options.A}  B) ${options.B}  C) ${options.C}  D) ${options.D}
Student answered: ${student_selected}
Correct answer: ${correct_answer}

Provide:
1. Why the correct answer is right (step-by-step working, show formula used)
2. Why the student's answer is wrong (common misconception)
3. A memory shortcut or trick to never get this wrong again
4. Related formula or concept to revise

Return as JSON:
{
  "why_correct": "...",
  "why_wrong": "...",
  "shortcut": "...",
  "revise_concept": "..."
}
`;

    // Use a fallback chain for model names to ensure availability
    const modelNames = ["gemini-2.0-flash", "gemini-flash-latest"];
    let text = "";
    let generationSuccess = false;

    for (const modelName of modelNames) {
      try {
        console.log(`[AI-Explain] Attempting with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        text = result.response.text();
        generationSuccess = true;
        break;
      } catch (err: any) {
        console.warn(`[AI-Explain] Model ${modelName} failed: ${err.message}`);
        if (modelName === modelNames[modelNames.length - 1]) throw err;
      }
    }
    
    if (!generationSuccess) throw new Error("AI generation failed for all models.");
    
    const explanationData = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(explanationData);

  } catch (error: any) {
    console.error("Explain Answer Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
