import React, { useState, useEffect } from 'react';
import { Pill, Activity, AlertCircle, CheckCircle2, AlertTriangle, FileCheck2 } from 'lucide-react';
import { PrescriptionUpload } from './components/PrescriptionUpload.tsx';
import { MedicationSummaryTable } from './components/MedicationSummaryTable.tsx';
import { PrescriptionDetailsCard } from './components/PrescriptionDetailsCard.tsx';
import { GoogleSheetsBar } from './components/GoogleSheetsBar.tsx';
import { DEFAULT_STOCK_CATALOG } from './data/defaultStock.ts';
import { SAMPLE_PRESCRIPTION_DATA } from './data/samplePrescription.ts';
import { ExtractedMedication, PrescriptionAnalysisResult, StockMedication } from './types.ts';
import { initAuth, googleSignIn, googleLogout, getAccessToken } from './lib/firebaseAuth.ts';
import { fetchGoogleSheetStock, findBestStockMatch } from './lib/sheetsService.ts';

export default function App() {
  // Authentication & Google Sheets State
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Stock Catalog State
  const [stockCatalog, setStockCatalog] = useState<StockMedication[]>(DEFAULT_STOCK_CATALOG);
  const [activeSheetName, setActiveSheetName] = useState<string>('Embedded Default Catalog');
  const [sheetUrl, setSheetUrl] = useState<string>('');
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [sheetNotification, setSheetNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Prescription Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PrescriptionAnalysisResult | null>(SAMPLE_PRESCRIPTION_DATA);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisSuccessAlert, setAnalysisSuccessAlert] = useState<string | null>(null);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setSheetNotification({
          type: 'success',
          message: `Connected as ${result.user.email}. You can now sync your Google Sheet stock catalog.`,
        });
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Failed to authenticate with Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await googleLogout();
      setUser(null);
      setToken(null);
      setSheetNotification(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleSyncSheet = async () => {
    if (!sheetUrl.trim()) {
      setErrorMessage('Please enter your Google Sheet URL or ID (valeurStockParDepot).');
      return;
    }

    const currentToken = token || getAccessToken();
    if (!currentToken) {
      setErrorMessage('Please connect your Google Account first to grant read access to your sheet.');
      handleLogin();
      return;
    }

    setIsSyncingSheet(true);
    setErrorMessage(null);
    try {
      const { title, medications } = await fetchGoogleSheetStock(sheetUrl, currentToken);
      if (medications.length === 0) {
        setSheetNotification({
          type: 'error',
          message: 'Sheet was read, but no medication rows were found. Check column formatting.',
        });
      } else {
        setStockCatalog(medications);
        setActiveSheetName(title || 'Google Sheet');
        setSheetNotification({
          type: 'success',
          message: `Successfully loaded ${medications.length} medications from "${title}".`,
        });

        // Re-match currently analyzed medications against new stock catalog
        if (analysisResult && analysisResult.medications.length > 0) {
          const updatedMeds = analysisResult.medications.map((med) => {
            const { match } = findBestStockMatch(med.detectedName, medications);
            const unitCost = match ? match.price : med.unitCost;
            const cycleCost = unitCost * med.unitsPerCycle;
            const totalCost = cycleCost * med.cycleCount;
            return {
              ...med,
              matchedStock: match,
              unitCost,
              cycleCost,
              totalCost,
            };
          });

          const totalOverallCost = updatedMeds.reduce((acc, m) => acc + m.totalCost, 0);
          setAnalysisResult({
            ...analysisResult,
            medications: updatedMeds,
            totalOverallCost,
          });
        }
      }
    } catch (err: any) {
      console.error('Sync Sheet error:', err);
      setErrorMessage(err.message || 'Failed to sync Google Sheet. Verify sharing permissions.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleResetToDefault = () => {
    setStockCatalog(DEFAULT_STOCK_CATALOG);
    setActiveSheetName('Embedded Default Catalog');
    setSheetNotification({
      type: 'success',
      message: 'Reset back to embedded pharmacy depot stock list.',
    });
  };

  // Analyze prescription image with Gemini
  const handleAnalyzePrescription = async (
    file: File | null,
    base64Data: string,
    mimeType: string
  ) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setAnalysisSuccessAlert(null);
    if (file) {
      setCurrentFileName(file.name);
    }

    try {
      const response = await fetch('/api/analyze-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType,
          stockCatalog: stockCatalog.slice(0, 150),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${response.status}`);
      }

      const resJson = await response.json();
      const extracted = resJson.data;

      if (!extracted || !extracted.medications || extracted.medications.length === 0) {
        throw new Error("No chemotherapy medications could be recognized in this image. Please check image clarity and handwriting legibility.");
      }

      // Enhance extracted medications with stock catalog matching
      const enrichedMeds: ExtractedMedication[] = extracted.medications.map(
        (m: any, idx: number) => {
          const detectedName = m.detectedName || m.originalText || 'Chemotherapy Drug';
          
          // Match against current stock catalog
          const { match, score } = findBestStockMatch(
            m.matchedMedicationHint || detectedName,
            stockCatalog
          );

          const cycleCount = m.cycleCount || extracted.clinicalContext?.totalCyclesPrescribed || 1;
          const unitsPerCycle = m.unitsPerCycle || 1;
          const unitCost = match ? match.price : (m.unitCost || 0);
          const cycleCost = unitCost * unitsPerCycle;
          const totalCost = cycleCost * cycleCount;

          return {
            id: m.id || `med-${Date.now()}-${idx + 1}`,
            originalText: m.originalText || '',
            detectedName,
            strength: m.strength || '',
            dosage: m.dosage || '',
            frequency: m.frequency || '',
            cycleCount,
            unitsPerCycle,
            notes: m.notes || '',
            matchedStock: match,
            matchScore: score,
            unitCost,
            cycleCost,
            totalCost,
            currency: 'EGP',
          };
        }
      );

      const totalOverallCost = enrichedMeds.reduce((sum, m) => sum + m.totalCost, 0);

      // Force instant UI table update with new prescription result
      setAnalysisResult({
        rawTranscription: extracted.rawTranscription || '',
        languageDetected: extracted.languageDetected || 'Mixed',
        clinicalContext: extracted.clinicalContext || {},
        medications: enrichedMeds,
        totalOverallCost,
        confidenceScore: 0.98,
      });

      setAnalysisSuccessAlert(
        `Prescription processed successfully! Recognized ${enrichedMeds.length} chemotherapy medication(s): ${enrichedMeds.map(m => m.detectedName).join(', ')}.`
      );

      // Smooth scroll to results table
      setTimeout(() => {
        const el = document.getElementById('medication-summary-table-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    } catch (err: any) {
      console.error('Prescription analysis error:', err);
      setErrorMessage(
        err.message || 'Error occurred while analyzing prescription handwriting. Please verify image and try again.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateMedication = (updated: ExtractedMedication) => {
    if (!analysisResult) return;
    const updatedMeds = analysisResult.medications.map((m) =>
      m.id === updated.id ? updated : m
    );
    const totalOverallCost = updatedMeds.reduce((sum, m) => sum + m.totalCost, 0);
    setAnalysisResult({
      ...analysisResult,
      medications: updatedMeds,
      totalOverallCost,
    });
  };

  const handleLoadSample = () => {
    setCurrentFileName('Cleocalfa Hospital Prescription Sample');
    setAnalysisResult(SAMPLE_PRESCRIPTION_DATA);
    setErrorMessage(null);
    setAnalysisSuccessAlert('Sample prescription loaded: Dostarlimab (Jemperli) 500mg - 3 cycles.');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 font-sans antialiased selection:bg-blue-500 selection:text-white pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  OncoRx Prescription Analyzer
                </h1>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 hidden sm:inline">
                  Pharmacy Chemotherapy Reader
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Automated Arabic & English prescription handwriting reader with cycle & overall pricing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-medium hidden md:inline">Gemini Vision 3.8</span>
              <span className="text-slate-400 font-normal">| Multilingual OCR</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold block">Notice</strong>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Analysis Success Banner */}
        {analysisSuccessAlert && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{analysisSuccessAlert}</span>
            </div>
            <button
              onClick={() => setAnalysisSuccessAlert(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 cursor-pointer underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sheet notification */}
        {sheetNotification && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between ${
              sheetNotification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{sheetNotification.message}</span>
            </div>
            <button
              onClick={() => setSheetNotification(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer underline"
            >
              Close
            </button>
          </div>
        )}

        {/* Google Sheets Inventory Bar */}
        <GoogleSheetsBar
          user={user}
          token={token}
          onLogin={handleLogin}
          onLogout={handleLogout}
          isLoggingIn={isLoggingIn}
          sheetUrl={sheetUrl}
          setSheetUrl={setSheetUrl}
          onSyncSheet={handleSyncSheet}
          isSyncing={isSyncingSheet}
          stockCatalog={stockCatalog}
          activeSheetName={activeSheetName}
          onResetToDefault={handleResetToDefault}
        />

        {/* Prescription Upload Section */}
        <PrescriptionUpload
          onAnalyze={handleAnalyzePrescription}
          isAnalyzing={isAnalyzing}
          onLoadSample={handleLoadSample}
          currentFileName={currentFileName}
        />

        {/* Summary Table of Medications & Cycle Costs */}
        {analysisResult && (
          <div className="space-y-6">
            <MedicationSummaryTable
              medications={analysisResult.medications}
              stockCatalog={stockCatalog}
              totalOverallCost={analysisResult.totalOverallCost}
              onUpdateMedication={handleUpdateMedication}
              currencySymbol="EGP"
            />

            {/* Extracted Details & Prescribed Protocol Context */}
            <PrescriptionDetailsCard analysis={analysisResult} />
          </div>
        )}
      </main>
    </div>
  );
}
