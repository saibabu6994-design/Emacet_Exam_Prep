const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually if needed, or pass them as args
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function importQuestions() {
  const jsonPath = path.join(__dirname, '../public/questions.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("Error: public/questions.json not found.");
    return;
  }

  const questions = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`Read ${questions.length} questions from JSON.`);

  // Filter out any that might have temporary IDs
  const cleanQuestions = questions.map(q => {
    const { id, ...rest } = q;
    // If id is a UUID, we can try to keep it, otherwise let DB generate
    if (id && id.length === 36) return { id, ...rest };
    return rest;
  });

  console.log("Importing to Supabase...");
  
  // Upsert to handle duplicates if IDs match
  const { data, error } = await supabase
    .from('questions')
    .upsert(cleanQuestions, { onConflict: 'question_text' });

  if (error) {
    console.error("Import error:", error);
  } else {
    console.log("Successfully imported/updated questions in Supabase!");
  }
}

importQuestions();
