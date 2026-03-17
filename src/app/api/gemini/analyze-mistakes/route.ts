import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { student_name, weak_topics, recent_scores } = await req.json();

    const prompt = `
You are a personalized TS EAMCET coach analyzing a student's performance data.

Student: ${student_name}
Weak topics (sorted by failure rate):
${JSON.stringify(weak_topics, null, 2)}

Recent exam scores (last 5): ${(recent_scores || []).join(", ")}

Provide a targeted, actionable 200-word study plan. Be specific:
- Which 2-3 topics to prioritize this week (from the weak topics listed)
- Recommended daily practice time in minutes
- Specific types of questions to focus on for each weak topic
- One motivational note

Return ONLY valid JSON, no markdown:
{
  "priority_topics": ["topic1", "topic2"],
  "study_plan": "detailed personalized study plan text...",
  "daily_minutes_recommended": 45,
  "encouragement": "motivational message"
}
`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const data = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Analyze Mistakes Error:", error);
    // Return a safe fallback so the UI doesn't break
    return NextResponse.json({
      priority_topics: ["General Practice"],
      study_plan: "Review your incorrect answers from past exams. Focus on understanding why each answer was wrong before practicing similar questions.",
      daily_minutes_recommended: 60,
      encouragement: "Every expert was once a beginner. Keep practicing!"
    });
  }
}
