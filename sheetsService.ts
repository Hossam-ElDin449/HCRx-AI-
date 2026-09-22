import { StockMedication } from '../types.ts';

/**
 * Parses Google Sheets spreadsheet URL or ID
 * e.g. https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Fetches sheet data using Google Sheets REST API v4
 */
export async function fetchGoogleSheetStock(
  spreadsheetIdOrUrl: string,
  accessToken: string,
  range = 'A1:E200'
): Promise<{ title: string; medications: StockMedication[] }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('Please enter a valid Google Sheet URL or Spreadsheet ID.');
  }

  // Get sheet metadata
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const errBody = await metaRes.json().catch(() => ({}));
    throw new Error(
      errBody.error?.message || `Failed to access Google Sheet (Status ${metaRes.status})`
    );
  }

  const metaData = await metaRes.json();
  const sheetTitle = metaData.properties?.title || 'valeurStockParDepot';
  const firstSheetName = metaData.sheets?.[0]?.properties?.title || 'Sheet1';

  // Read values
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetName)}!${range}`;
  const valuesRes = await fetch(valuesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!valuesRes.ok) {
    const errBody = await valuesRes.json().catch(() => ({}));
    throw new Error(
      errBody.error?.message || `Failed to fetch spreadsheet rows (${valuesRes.status})`
    );
  }

  const valuesData = await valuesRes.json();
  const rows: string[][] = valuesData.values || [];

  if (rows.length === 0) {
    return { title: sheetTitle, medications: [] };
  }

  // Identify column headers
  const headerRow = rows[0].map(h => (h || '').toString().toLowerCase().trim());
  let priceIdx = headerRow.findIndex(h => h.includes('price') || h.includes('prix') || h.includes('cost') || h.includes('سعر'));
  let unitIdx = headerRow.findIndex(h => h.includes('unit') || h.includes('unite') || h.includes('وحدة'));
  let catIdx = headerRow.findIndex(h => h.includes('cat') || h.includes('class') || h.includes('فئة'));
  let nameIdx = headerRow.findIndex(h => h.includes('name') || h.includes('med') || h.includes('nom') || h.includes('اسم') || h.includes('designation'));
  let codeIdx = headerRow.findIndex(h => h.includes('code') || h.includes('id') || h.includes('ref') || h.includes('كود'));

  // Default fallback to user's CSV column format if headers match standard: price, unit, cat, med name, code
  if (priceIdx === -1) priceIdx = 0;
  if (unitIdx === -1) unitIdx = 1;
  if (catIdx === -1) catIdx = 2;
  if (nameIdx === -1) nameIdx = 3;
  if (codeIdx === -1) codeIdx = 4;

  const medications: StockMedication[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawPrice = row[priceIdx] || '0';
    const cleanPrice = parseFloat(String(rawPrice).replace(/[^\d.-]/g, '')) || 0;
    const unit = (row[unitIdx] || 'Vial').trim();
    const cat = (row[catIdx] || 'Chemotherapy').trim();
    const medName = (row[nameIdx] || '').trim();
    const code = (row[codeIdx] || `MED-${i}`).trim();

    if (medName) {
      medications.push({
        price: cleanPrice,
        unit,
        cat,
        medName,
        code,
      });
    }
  }

  return {
    title: sheetTitle,
    medications,
  };
}

/**
 * Fuzzy matching helper to match extracted prescription drug names with stock catalog
 */
export function findBestStockMatch(
  detectedName: string,
  stockCatalog: StockMedication[]
): { match: StockMedication | null; score: number } {
  if (!detectedName || stockCatalog.length === 0) {
    return { match: null, score: 0 };
  }

  const cleanTarget = detectedName.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 2);

  let bestMatch: StockMedication | null = null;
  let highestScore = 0;

  for (const item of stockCatalog) {
    const cleanItemName = item.medName.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    let score = 0;

    // Check exact or partial substring
    if (cleanItemName.includes(cleanTarget) || cleanTarget.includes(cleanItemName)) {
      score += 60;
    }

    // Word matching
    for (const word of targetWords) {
      if (cleanItemName.includes(word)) {
        // Boost for distinctive drug stem (e.g. dostarlimab, jemperli, paclitaxel, carboplatin)
        if (word.length >= 6) {
          score += 35;
        } else {
          score += 15;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return {
    match: highestScore >= 30 ? bestMatch : null,
    score: highestScore,
  };
}
