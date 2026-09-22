import React from 'react';
import { Calculator, AlertTriangle, Layers, Pill, Check, Tag } from 'lucide-react';
import { ExtractedMedication, StockMedication } from '../types.ts';

interface MedicationSummaryTableProps {
  medications: ExtractedMedication[];
  stockCatalog: StockMedication[];
  totalOverallCost: number;
  onUpdateMedication: (updated: ExtractedMedication) => void;
  currencySymbol?: string;
}

export const MedicationSummaryTable: React.FC<MedicationSummaryTableProps> = ({
  medications,
  stockCatalog,
  totalOverallCost,
  onUpdateMedication,
  currencySymbol = 'EGP',
}) => {
  if (medications.length === 0) {
    return null;
  }

  const handleStockChange = (med: ExtractedMedication, selectedCode: string) => {
    const matched = stockCatalog.find((s) => s.code === selectedCode) || null;
    const unitCost = matched ? matched.price : 0;
    const cycleCost = unitCost * med.unitsPerCycle;
    const totalCost = cycleCost * med.cycleCount;

    onUpdateMedication({
      ...med,
      matchedStock: matched,
      unitCost,
      cycleCost,
      totalCost,
    });
  };

  const handleUnitsChange = (med: ExtractedMedication, val: number) => {
    const units = Math.max(0.1, val);
    const cycleCost = med.unitCost * units;
    const totalCost = cycleCost * med.cycleCount;
    onUpdateMedication({
      ...med,
      unitsPerCycle: units,
      cycleCost,
      totalCost,
    });
  };

  const handleCyclesChange = (med: ExtractedMedication, val: number) => {
    const cycles = Math.max(1, Math.round(val));
    const totalCost = med.cycleCost * cycles;
    onUpdateMedication({
      ...med,
      cycleCount: cycles,
      totalCost,
    });
  };

  const handleCustomPriceChange = (med: ExtractedMedication, val: number) => {
    const unitCost = Math.max(0, val);
    const cycleCost = unitCost * med.unitsPerCycle;
    const totalCost = cycleCost * med.cycleCount;
    onUpdateMedication({
      ...med,
      unitCost,
      cycleCost,
      totalCost,
    });
  };

  return (
    <div id="medication-summary-table-section" className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Pill className="w-4 h-4 text-blue-600" />
            <span>Extracted Chemotherapy Medications & Pricing</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Matched against your pharmacy stock inventory for exact cycle and overall cost determination
          </p>
        </div>

        {/* Total Cost Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-blue-50 border border-blue-200/80 rounded-xl px-4 py-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-blue-800 tracking-wider block">
              Total Overall Cost
            </span>
            <span className="text-base sm:text-lg font-bold text-blue-900 leading-none">
              {totalOverallCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 border-collapse">
          <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 py-3 min-w-[200px]">Medication Name & Strength</th>
              <th scope="col" className="px-4 py-3 min-w-[240px]">Matched Stock Item (valeurStockParDepot)</th>
              <th scope="col" className="px-3 py-3 text-center w-24">Cycle Doses</th>
              <th scope="col" className="px-3 py-3 text-center w-24">Units/Cycle</th>
              <th scope="col" className="px-4 py-3 text-right min-w-[120px]">Unit Price</th>
              <th scope="col" className="px-4 py-3 text-right min-w-[130px]">Cycle Price</th>
              <th scope="col" className="px-4 py-3 text-right min-w-[140px]">Overall Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {medications.map((med, idx) => {
              const hasMatch = !!med.matchedStock;
              return (
                <tr key={med.id || idx} className="hover:bg-slate-50/60 transition-colors">
                  {/* Prescribed Drug */}
                  <td className="px-4 py-3.5 align-top">
                    <div className="font-semibold text-slate-900 text-sm">
                      {med.detectedName}
                    </div>
                    {med.strength && (
                      <div className="text-xs text-blue-700 font-medium inline-block bg-blue-50 px-2 py-0.5 rounded mt-1">
                        {med.strength}
                      </div>
                    )}
                    {med.frequency && (
                      <div className="text-xs text-slate-500 mt-1">
                        Freq: <span className="text-slate-700">{med.frequency}</span>
                      </div>
                    )}
                    {med.notes && (
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2" title={med.notes}>
                        {med.notes}
                      </div>
                    )}
                  </td>

                  {/* Stock Match Dropdown */}
                  <td className="px-4 py-3.5 align-top">
                    <div className="space-y-1.5">
                      <select
                        id={`select-stock-${med.id}`}
                        value={med.matchedStock?.code || ''}
                        onChange={(e) => handleStockChange(med, e.target.value)}
                        className={`w-full text-xs py-1.5 px-2.5 rounded-lg border focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                          hasMatch
                            ? 'border-slate-200 bg-white text-slate-800'
                            : 'border-amber-300 bg-amber-50/50 text-amber-900'
                        }`}
                      >
                        <option value="">-- Select or link stock item --</option>
                        {stockCatalog.map((item, sIdx) => (
                          <option key={`${item.code}-${sIdx}`} value={item.code}>
                            {item.medName} — {item.price.toLocaleString()} {currencySymbol} / {item.unit}
                          </option>
                        ))}
                      </select>

                      {hasMatch ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                          <Check className="w-3.5 h-3.5" />
                          <span>Linked to depot code: {med.matchedStock?.code}</span>
                          <span className="text-slate-400">({med.matchedStock?.unit})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Manual matching required (enter price or select item)</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Cycle count */}
                  <td className="px-3 py-3.5 align-top text-center">
                    <div className="inline-flex flex-col items-center">
                      <input
                        id={`input-cycles-${med.id}`}
                        type="number"
                        min="1"
                        max="30"
                        value={med.cycleCount}
                        onChange={(e) => handleCyclesChange(med, parseFloat(e.target.value) || 1)}
                        className="w-16 text-center text-xs font-semibold py-1 px-1.5 rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-1">Cycles</span>
                    </div>
                  </td>

                  {/* Units per cycle */}
                  <td className="px-3 py-3.5 align-top text-center">
                    <div className="inline-flex flex-col items-center">
                      <input
                        id={`input-units-${med.id}`}
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={med.unitsPerCycle}
                        onChange={(e) => handleUnitsChange(med, parseFloat(e.target.value) || 1)}
                        className="w-16 text-center text-xs font-semibold py-1 px-1.5 rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-1">
                        {med.matchedStock?.unit || 'Vials'}
                      </span>
                    </div>
                  </td>

                  {/* Unit price */}
                  <td className="px-4 py-3.5 align-top text-right font-medium">
                    <div className="flex items-center justify-end gap-1">
                      <input
                        id={`input-unitprice-${med.id}`}
                        type="number"
                        min="0"
                        step="0.5"
                        value={med.unitCost}
                        onChange={(e) => handleCustomPriceChange(med, parseFloat(e.target.value) || 0)}
                        className="w-24 text-right text-xs font-mono py-1 px-1.5 rounded-md border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      per {med.matchedStock?.unit || 'unit'}
                    </span>
                  </td>

                  {/* Cycle Price */}
                  <td className="px-4 py-3.5 align-top text-right font-semibold text-slate-800">
                    <span className="font-mono text-xs sm:text-sm">
                      {med.cycleCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {currencySymbol} / cycle
                    </span>
                  </td>

                  {/* Overall Total Price */}
                  <td className="px-4 py-3.5 align-top text-right font-bold text-blue-900 bg-blue-50/30">
                    <span className="font-mono text-sm sm:text-base">
                      {med.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-blue-700 block mt-0.5">
                      {currencySymbol} ({med.cycleCount} cycles)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Layers className="w-4 h-4 text-slate-400" />
          <span>
            Calculations reflect: <strong>Cycle Price</strong> = Unit Price × Units/Cycle; <strong>Overall Price</strong> = Cycle Price × Number of Cycles
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Prescription Grand Total:</span>
            <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
              {totalOverallCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currencySymbol}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
