export interface StockMedication {
  price: number;
  unit: string;
  cat: string;
  medName: string;
  code: string;
}

export interface ExtractedMedication {
  id: string;
  originalText: string;
  detectedName: string; // e.g. "Dostarlimab (Jemperli)"
  strength: string; // e.g. "500 mg"
  dosage: string; // e.g. "500 mg IV"
  frequency: string; // e.g. "every 21 days (q3w)"
  cycleCount: number; // e.g. 3 cycles
  notes?: string;
  // Match results from stock catalog / Google Sheets
  matchedStock?: StockMedication | null;
  matchScore?: number;
  // Quantities & Calculations
  unitsPerCycle: number; // e.g. 1 vial per cycle
  unitCost: number; // Price per unit/vial
  cycleCost: number; // Cost for 1 cycle
  totalCost: number; // Cost for all cycles
  currency: string;
}

export interface PrescriptionAnalysisResult {
  rawTranscription: string;
  languageDetected: 'Arabic' | 'English' | 'Mixed';
  clinicalContext: {
    protocolSummary?: string;
    cycleDurationDays?: number;
    totalCyclesPrescribed?: number;
    arabicNotesIgnored?: string[];
  };
  medications: ExtractedMedication[];
  totalOverallCost: number;
  confidenceScore: number;
}
