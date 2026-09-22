import { PrescriptionAnalysisResult } from '../types.ts';

export const SAMPLE_PRESCRIPTION_DATA: PrescriptionAnalysisResult = {
  rawTranscription: `R/
تعاني من ورم غير حميد بعنق الرحم مرتجع مع ثانويات بالرئة والكبد وتلقت أكثر من خط من العلاج الكيماوي وتحتاج للعلاج المقالي بالبروتوكول التالي:
- Dostarlimab (Jemperli) 500 mg
جرعة كل 21 يوم عدد 3 جرعات
ثم إعادة التقييم ، وذلك لوجود زيادة بالأورام بعد عمل المسح الذري.`,
  languageDetected: 'Mixed',
  clinicalContext: {
    protocolSummary: 'Dostarlimab (Jemperli) 500 mg IV infusion administered every 21 days for 3 cycles, followed by restaging scan.',
    cycleDurationDays: 21,
    totalCyclesPrescribed: 3,
    arabicNotesIgnored: [
      'Header: Cleocalfa Oncology Center of Excellence / Nile Badrawi Hospital (Cleopatra Group)',
      'Patient demographic lines and date: 14/8/2026',
      'Hotline: 19668 and medical booking details',
      'Physician signature stamp'
    ],
  },
  medications: [
    {
      id: 'med-dostarlimab-1',
      originalText: 'Dostarlimab (Jemperli) 500 mg - جرعة كل 21 يوم عدد 3 جرعات',
      detectedName: 'Dostarlimab (Jemperli)',
      strength: '500 mg',
      dosage: '500 mg IV infusion',
      frequency: 'Every 21 days (q3w)',
      cycleCount: 3,
      unitsPerCycle: 1,
      unitCost: 95000.00,
      cycleCost: 95000.00,
      totalCost: 285000.00,
      currency: 'EGP',
      notes: 'Immunotherapy protocol: 1 vial (500mg) IV every 21 days for 3 cycles (total 3 vials). PET restaging thereafter.',
      matchedStock: {
        price: 95000.00,
        unit: 'Vial',
        cat: 'Immuno-oncology',
        medName: 'Jemperli (Dostarlimab) 500 mg/10 mL vial',
        code: 'PH105020999',
      },
      matchScore: 95,
    },
  ],
  totalOverallCost: 285000.00,
  confidenceScore: 0.98,
};
