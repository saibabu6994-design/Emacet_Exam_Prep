require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: session } = await supabase.from('exam_sessions').select('*').eq('id', '45f8c65a-2380-4562-b266-f6427226d60c').single();
  console.log('Session subject_ids:', session?.subject_ids);

  const { data: questions } = await supabase.from('questions').select('id, subject_id, question_text').in('subject_id', session?.subject_ids || []);
  console.log('Found questions:', questions?.length);
  
  const { data: allQuestions } = await supabase.from('questions').select('id, subject_id');
  console.log('All questions subjects:', allQuestions?.map(q => q.subject_id));
}
check();
