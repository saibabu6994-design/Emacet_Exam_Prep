import { NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
import mammoth from "mammoth";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsedContent = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const data = await pdf(buffer);
      parsedContent = data.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      const data = await mammoth.extractRawText({ buffer });
      parsedContent = data.value;
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Only PDF and DOCX are allowed." },
        { status: 400 }
      );
    }

    // Limit the length to around 8000 tokens (approx 32000 chars) as per prompt
    if (parsedContent.length > 32000) {
        parsedContent = parsedContent.substring(0, 32000);
    }

    return NextResponse.json({ parsedContent });
  } catch (error: any) {
    console.error("Parse Document Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
