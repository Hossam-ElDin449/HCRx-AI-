import React from 'react';
import { FileText, ShieldCheck, Calendar, Info, Globe2, EyeOff } from 'lucide-react';
import { PrescriptionAnalysisResult } from '../types.ts';

interface PrescriptionDetailsCardProps {
  analysis: PrescriptionAnalysisResult;
}

export const PrescriptionDetailsCard: React.FC<PrescriptionDetailsCardProps> = ({ analysis }) => {
  return (
    <div id="prescription-extracted-details" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 tracking-tight flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <span>Extracted Clinical Prescription Context</span>
        </h3>
        <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
          <Globe2 className="w-3 h-3 text-slate-500" />
          Language: {analysis.languageDetected}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Protocol Summary */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Cycle Schedule & Regimen</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {analysis.clinicalContext.protocolSummary || 'Regimen identified from prescription handwriting.'}
          </p>
          <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-500">
            {analysis.clinicalContext.cycleDurationDays && (
              <span>Cycle length: <strong className="text-slate-700">{analysis.clinicalContext.cycleDurationDays} days</strong></span>
            )}
            {analysis.clinicalContext.totalCyclesPrescribed && (
              <span>Total prescribed: <strong className="text-slate-700">{analysis.clinicalContext.totalCyclesPrescribed} cycles</strong></span>
            )}
          </div>
        </div>

        {/* Ignored Demographics / Header Info */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <EyeOff className="w-3.5 h-3.5 text-amber-600" />
            <span>Excluded Administrative Details</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mb-2">
            The following non-clinical elements were identified and filtered out as requested:
          </p>
          <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
            <li>Hospital / Clinic Header (Cleocalfa / Nile Badrawi)</li>
            <li>Doctor name, signature, stamp & hotline (19668)</li>
            <li>Patient identification, age, file number & date</li>
          </ul>
        </div>

        {/* Verbatim Transcription */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>Prescription Transcription & Arabic Notes</span>
          </div>
          <div
            className="text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200/70 max-h-[100px] overflow-y-auto whitespace-pre-wrap leading-relaxed"
            dir="auto"
          >
            {analysis.rawTranscription || 'Transcription complete.'}
          </div>
        </div>
      </div>
    </div>
  );
};
