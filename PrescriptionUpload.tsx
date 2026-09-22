import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, AlertCircle, FileText, ArrowRight, CheckCircle2 } from 'lucide-react';

interface PrescriptionUploadProps {
  onAnalyze: (file: File | null, base64: string, mimeType: string) => void;
  isAnalyzing: boolean;
  onLoadSample: () => void;
  currentFileName?: string | null;
}

export const PrescriptionUpload: React.FC<PrescriptionUploadProps> = ({
  onAnalyze,
  isAnalyzing,
  onLoadSample,
  currentFileName,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPEG, PNG, WEBP).');
      return;
    }

    setSelectedFile(file);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);
      setBase64Data(result);
      // Automatically trigger analysis on upload so table updates right away
      onAnalyze(file, result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualAnalyze = () => {
    if (!base64Data) return;
    onAnalyze(selectedFile, base64Data, mimeType);
  };

  return (
    <div id="prescription-upload-section" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Upload Handwritten Prescription</span>
            <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
              Arabic & English Multi-lingual
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chemotherapy and immunotherapy handwritten prescription reader with automatic dosage and cycle extraction
          </p>
        </div>

        {/* Quick sample button */}
        <button
          id="btn-load-sample-prescription"
          type="button"
          onClick={() => {
            setPreviewUrl(null);
            setSelectedFile(null);
            setBase64Data(null);
            onLoadSample();
          }}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer self-start sm:self-auto"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Load Sample (Cleocalfa Dostarlimab)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Dropzone Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`md:col-span-7 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[210px] ${
            dragOver
              ? 'border-blue-500 bg-blue-50/50'
              : previewUrl
              ? 'border-emerald-300 bg-emerald-50/20'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/30'
          }`}
        >
          <input
            id="file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processFile(e.target.files[0]);
              }
            }}
          />

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs mb-3 text-blue-600">
            <UploadCloud className="w-6 h-6" />
          </div>

          <p className="text-sm font-medium text-slate-700">
            {selectedFile
              ? selectedFile.name
              : currentFileName
              ? `Current image: ${currentFileName}`
              : 'Click to upload new prescription image or drag and drop here'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Supports mobile photos, camera uploads, scanned JPEG, PNG, WEBP
          </p>

          {selectedFile && (
            <span className="mt-2 text-xs text-emerald-600 font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Uploaded & ready for analysis
            </span>
          )}

          <span className="mt-3 text-[11px] text-slate-500 inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            Hospital header, doctor info & patient demographics are ignored automatically
          </span>
        </div>

        {/* Preview & Action Panel */}
        <div className="md:col-span-5 flex flex-col justify-between border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Document Preview
              </span>
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                    setBase64Data(null);
                  }}
                  className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {previewUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white max-h-[170px] flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Prescription preview"
                  className="object-contain max-h-[170px] w-full"
                />
              </div>
            ) : (
              <div className="h-[150px] rounded-lg border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-slate-400 text-xs text-center p-3">
                <ImageIcon className="w-8 h-8 text-slate-300 mb-1" />
                <span>Upload a prescription to display and extract details</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 mt-3">
            <button
              id="btn-analyze-prescription"
              type="button"
              onClick={handleManualAnalyze}
              disabled={!base64Data || isAnalyzing}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm flex items-center justify-center gap-2 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing handwriting & updating table...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Re-analyze Image & Calculate</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
