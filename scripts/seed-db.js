require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seed() {
  console.log("🌱 Seeding Test Data...");

  // 1. Create a pre-confirmed Admin User
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  console.log(`👤 Creating Admin User: ${adminEmail}...`);
  const { data: adminAuthData, error: adminErr } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: 'password123',
    email_confirm: true,
    user_metadata: {
        role: 'admin',
        full_name: 'Admin Tester'
    }
  });
  
  if (adminErr && !adminErr.message.includes('already exists')) {
     console.error("❌ Admin Creation failed:", adminErr);
  } else {
     console.log("✅ Admin User ready.");
  }

  // 2. Create a pre-confirmed Student User
  const studentEmail = 'student@example.com';
  console.log(`👤 Creating Student User: ${studentEmail}...`);
  const { data: studentAuthData, error: studentErr } = await supabase.auth.admin.createUser({
    email: studentEmail,
    password: 'password123',
    email_confirm: true,
    user_metadata: {
        role: 'student',
        full_name: 'Student Tester',
        target_exam: 'EAMCET'
    }
  });

  if (studentErr && !studentErr.message.includes('already exists')) {
     console.error("❌ Student Creation failed:", studentErr);
  } else {
     console.log("✅ Student User ready.");
     
     // Ensure record exists in students table
     if (studentAuthData.user) {
         await supabase.from('students').upsert({
             id: studentAuthData.user.id,
             email: studentEmail,
             full_name: 'Student Tester',
             target_exam: 'EAMCET'
         });
     }
  }

  // 3. Seed some basic subjects and topics
  console.log("📚 Seeding Subjects...");
  const { data: subjectRows, error: subErr } = await supabase.from('subjects').upsert([
      { id: 1, name: 'Physics', exam_type: 'EAMCET' },
      { id: 2, name: 'Chemistry', exam_type: 'EAMCET' },
      { id: 3, name: 'Mathematics', exam_type: 'EAMCET' }
  ]).select();
  if (subErr) console.error("❌ Subjects error:", subErr);
  else console.log("✅ Subjects ready.");

  // 4. Seed some sample questions if empty
  console.log("📝 Checking Questions...");
  const { data: existingQ } = await supabase.from('questions').select('id').limit(1);
  if (!existingQ || existingQ.length === 0) {
      console.log("📝 Injecting sample questions...");
      const { error: qErr } = await supabase.from('questions').upsert([
          {
              question_text: 'What is the SI unit of Force?',
              option_a: 'Joule',
              option_b: 'Newton',
              option_c: 'Pascal',
              option_d: 'Watt',
              correct_answer: 'B',
              explanation: 'Newton is the SI unit of force, defined as 1 kg·m/s².',
              shortcut_tip: 'F = ma',
              subject_id: 1,
              difficulty: 'easy'
          },
          {
              question_text: 'What is the chemical formula for water?',
              option_a: 'H2O2',
              option_b: 'CO2',
              option_c: 'H2O',
              option_d: 'HO2',
              correct_answer: 'C',
              explanation: 'Water consists of two hydrogen atoms and one oxygen atom.',
              subject_id: 2,
              difficulty: 'easy'
          },
          {
              question_text: 'What is the derivative of x^2?',
              option_a: 'x',
              option_b: '2x',
              option_c: 'x^2/2',
              option_d: '2',
              correct_answer: 'B',
              explanation: 'Using the power rule, d/dx(x^n) = n*x^(n-1). For x^2, this is 2x.',
              shortcut_tip: 'Power rule: drop the exponent down and subtract 1.',
              subject_id: 3,
              difficulty: 'easy'
          }
      ]);
      if (qErr) console.error("❌ Questions error:", qErr);
      else console.log("✅ Questions injected.");
  } else {
      console.log("✅ Questions already exist.");
  }

  console.log("\n🚀 SEEDING COMPLETE!");
  console.log("You can now log in with the following credentials:");
  console.log("--------------------------------------------------");
  console.log("Role   | Email                 | Password");
  console.log("--------------------------------------------------");
  console.log(`Admin  | ${adminEmail} | password123`);
  console.log(`Student| ${studentEmail}   | password123`);
  console.log("--------------------------------------------------");
}

seed();
