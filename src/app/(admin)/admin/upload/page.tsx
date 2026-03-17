'use client'

import { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, XCircle, File } from "lucide-react";
import { createClient } from "@/lib/supabase";
import toast from "react-hot-toast";

type UploadStep = 'select' | 'uploading' | 'parsing' | 'review' | 'done';

export default function AdminUploadPage() {
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [parsedText, setParsedText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  // Tagging State
  const [year, setYear] = useState("2023");
  const [subjectId, setSubjectId] = useState("1"); // Assume 1=Physics
  const [docType, setDocType] = useState("question_paper");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type === "application/pdf" || selectedFile.name.endsWith(".docx") || selectedFile.name.endsWith(".pdf")) {
      setFile(selectedFile);
    } else {
      toast.error("Only PDF and DOCX files are supported.");
    }
  };

  const processFile = async () => {
    if (!file) return;

    try {
      setStep('uploading');
      
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `raw/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('source-documents')
        .upload(filePath, file);

      if (uploadError) {
          // If bucket doesn't exist, this will throw
          toast.error(`Upload error: Make sure 'source-documents' bucket exists publically.`);
          throw uploadError;
      }

      const fileUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/source-documents/${filePath}`;

      // 2. Parse via API
      setStep('parsing');
      const formData = new FormData();
      formData.append('file', file);

      const parseRes = await fetch('/api/gemini/parse-document', {
        method: 'POST',
        body: formData,
      });

      if (!parseRes.ok) throw new Error("Failed to parse document");

      const { parsedContent } = await parseRes.json();
      setParsedText(parsedContent);
      setStep('review');

      // Keep URL temporarily in states so it can be saved in review step
      (window as any).__tempFileUrl = fileUrl;

    } catch (e: any) {
      toast.error(e.message || "An error occurred");
      setStep('select');
    }
  };

  const saveSourceDocument = async () => {
      const fileUrl = (window as any).__tempFileUrl;
      const { error } = await supabase.from('source_documents').insert({
          file_name: file?.name,
          file_url: fileUrl,
          doc_type: docType,
          year: parseInt(year),
          subject_id: parseInt(subjectId),
          parsed_content: parsedText,
      });

      if (error) {
          toast.error("Failed to save to database: " + error.message);
      } else {
          toast.success("Document saved successfully!");
          setStep('done');
      }
  };

  const reset = () => {
      setFile(null);
      setParsedText("");
      setStep('select');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload Source Document</h1>
        <p className="text-slate-500 mt-1">Upload PDF or DOCX files for Gemini to analyze and generate questions from.</p>
      </div>

      {step === 'select' && (
        <div 
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => {
                if (e.target.files && e.target.files[0]) handleFileSelect(e.target.files[0])
            }}
          />
          <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <UploadCloud className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-800 mb-1">Drag and drop file here</h3>
          <p className="text-slate-500 text-sm mb-6">Supports PDF and DOCX up to 10MB</p>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Browse Files
          </button>

          {file && (
              <div className="mt-6 flex items-center justify-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg max-w-sm mx-auto">
                  <File className="w-5 h-5 text-indigo-500" />
                  <span className="text-sm font-medium truncate">{file.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-slate-400 hover:text-red-500">
                      <XCircle className="w-5 h-5"/>
                  </button>
              </div>
          )}

          {file && (
              <div className="mt-6">
                  <button onClick={processFile} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition w-full max-w-sm">
                      Upload & Parse Document
                  </button>
              </div>
          )}
        </div>
      )}

      {(step === 'uploading' || step === 'parsing') && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-sm">
          <div className="animate-pulse flex flex-col items-center">
             <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
             <h3 className="text-lg font-medium text-slate-800">{step === 'uploading' ? 'Uploading to Storage...' : 'Extracting Text (AI)...'}</h3>
             <p className="text-slate-500 mt-2">This may take a few moments depending on file size.</p>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="font-medium text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500"/>
                    Extraction Successful
                </h3>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                   <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Extracted Text Preview</h4>
                   <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-[400px] overflow-auto text-sm font-mono text-slate-700">
                       {parsedText?.substring(0, 1500)}...
                       <div className="mt-4 pt-4 border-t border-slate-200 text-center text-slate-400">
                           {parsedText?.length} characters total
                       </div>
                   </div>
                </div>
                
                <div className="space-y-6">
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Document Tags</h4>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border">
                                <option value="1">Physics</option>
                                <option value="2">Chemistry</option>
                                <option value="3">Mathematics</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Year</label>
                            <input type="number" value={year} onChange={e => setYear(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                            <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full border-slate-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 border">
                                <option value="question_paper">Question Paper</option>
                                <option value="answer_key">Answer Key</option>
                                <option value="shortcut_guide">Shortcut Guide</option>
                            </select>
                        </div>

                        <button onClick={saveSourceDocument} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition mt-6">
                            Save Document
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {step === 'done' && (
           <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-sm">
             <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
               <CheckCircle2 className="w-8 h-8 text-emerald-600" />
             </div>
             <h3 className="text-lg font-medium text-slate-800">Document Uploaded & Saved!</h3>
             <p className="text-slate-500 mt-2 mb-6">You can now use this document to generate AI questions.</p>
             <button onClick={reset} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
                 Upload Another File
             </button>
           </div>
      )}
    </div>
  );
}
