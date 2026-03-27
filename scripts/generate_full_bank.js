const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

// --- MULTI-KEY CONFIGURATION ---
const rawKeys = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
const API_KEYS = rawKeys.split(',').map(k => k.trim()).filter(Boolean);

if (API_KEYS.length === 0) {
  console.error("Error: No GEMINI_API_KEY found.");
  console.log("Run with: $env:GEMINI_API_KEY='key1,key2'; node scripts/generate_full_bank.js");
  process.exit(1);
}

const genAIs = API_KEYS.map(key => new GoogleGenerativeAI(key));
const models = genAIs.map(ai => ai.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' }));
let currentKeyIndex = 0;

function getNextModel() {
  const model = models[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % models.length;
  return model;
}

const QUESTIONS_PER_TOPIC = Number(process.env.QUESTIONS_PER_TOPIC) || 25;
const BATCH_SIZE = 10; // Slightly smaller for better consistency

const subjects = {
  1: { name: "Physics", topics: { 1: 'Laws of Motion', 2: 'Work, Energy & Power', 3: 'Gravitation', 4: 'Waves & Optics', 5: 'Electrostatics', 6: 'Current Electricity', 7: 'Magnetism', 8: 'Modern Physics' } },
  2: { name: "Chemistry", topics: { 1: 'Atomic Structure', 2: 'Chemical Bonding', 3: 'Organic Chemistry', 4: 'Thermodynamics', 5: 'Equilibrium', 6: 'Electrochemistry', 7: 'Coordination Compounds', 8: 'p-Block Elements' } },
  3: { name: "Mathematics", topics: { 1: 'Algebra', 2: 'Calculus', 3: 'Coordinate Geometry', 4: 'Trigonometry', 5: 'Probability & Statistics', 6: 'Vectors & 3D', 7: 'Differential Equations', 8: 'Matrices' } }
};

async function generateBatch(topicName, subjectName, count, sid, tid, bid) {
  const model = getNextModel();
  process.stdout.write(`[${topicName}] Requesting ${count} questions... `);

  const prompt = `Generate exactly ${count} Multiple Choice Questions (MCQs) for the TS EAMCET exam.
Subject: ${subjectName}
Topic: ${topicName}

Return a JSON array of objects. Each object MUST have these fields:
- id: A unique string in this format: "gen-${sid}-${tid}-${bid}-" followed by a unique index (1 to ${count}).
- question_text: The question content (use LaTeX with $...$ for math, e.g., $x^2$).
- option_a: Choice A
- option_b: Choice B
- option_c: Choice C
- option_d: Choice D
- correct_answer: One character "A", "B", "C", or "D".
- explanation: A clear solution using LaTeX for math.
- shortcut_tip: A quick trick or mnemonic.
- difficulty: One of "easy", "medium", or "hard".

CRITICAL: Return ONLY a valid JSON array. No markdown, no preamble, no explanations outside the JSON.`;

  let attempts = 0;
  while (attempts < 3) {
    try {
      attempts++;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      // Remove markdown code blocks if present
      const cleaned = text.replace(/```json|```/g, "").trim();
      
      let parsed = JSON.parse(cleaned);
      // Ensure it's an array
      if (!Array.isArray(parsed)) {
        if (typeof parsed === 'object' && parsed !== null) {
          parsed = [parsed];
        } else {
          throw new Error("Response is not a valid JSON array or object");
        }
      }
      return parsed;
    } catch (err) {
      if (err.message.includes('429')) {
        process.stdout.write(`Rate limit! Waiting 30s... `);
        await new Promise(r => setTimeout(r, 30000));
      } else {
        console.error(`\nError (Attempt ${attempts}):`, err.message);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  return [];
}

async function start() {
  const jsonPath = path.join(__dirname, '../public/questions.json');
  let currentQuestions = [];

  try {
    if (fs.existsSync(jsonPath)) {
      currentQuestions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch (e) { currentQuestions = []; }

  const existingIds = new Set(currentQuestions.map(q => q.id));
  console.log(`Starting with ${currentQuestions.length} existing questions. Using ${API_KEYS.length} API keys.`);

  for (const [sId, sData] of Object.entries(subjects)) {
    for (const [tId, tName] of Object.entries(sData.topics)) {
      let topicAdded = 0;
      const numBatches = Math.ceil(QUESTIONS_PER_TOPIC / BATCH_SIZE);

      for (let b = 0; b < numBatches; b++) {
        const count = Math.min(BATCH_SIZE, QUESTIONS_PER_TOPIC - (b * BATCH_SIZE));
        const res = await generateBatch(tName, sData.name, count, sId, tId, b + 1);

        res.forEach(q => {
          if (!existingIds.has(q.id)) {
            currentQuestions.push({ ...q, subject_id: Number(sId), topic_id: Number(tId) });
            existingIds.add(q.id);
            topicAdded++;
          }
        });

        // Save immediately
        fs.writeFileSync(jsonPath, JSON.stringify(currentQuestions, null, 2));

        // Balanced delay: shorter if using multiple keys
        const delay = API_KEYS.length > 1 ? 5000 : 12000;
        await new Promise(r => setTimeout(r, delay));
      }
      console.log(`✅ ${tName}: +${topicAdded} Qs (Total: ${currentQuestions.length})`);
    }
  }
  console.log("\n🚀 DONE! Question bank is fully populated.");
}

start();
