import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support high-resolution photos
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/analyze-prescription", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg", stockCatalog = [] } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ error: "No image payload provided" });
      }

      const ai = getAIClient();
      const pureBase64 = imageBase64.replace(/^data:image\/[a-z0-9+.-]+;base64,/, "");

      // Provide comprehensive stock list sample to guide the matching
      const stockSummary = (Array.isArray(stockCatalog) && stockCatalog.length > 0)
        ? stockCatalog.slice(0, 150).map((s: any) => `- ${s.medName} [Code: ${s.code}, Price: ${s.price} ${s.unit}]`).join("\n")
        : "";

      const prompt = `You are an expert oncology pharmacist specializing in reading medical prescriptions with chemotherapy and immunotherapy drugs, often handwritten in a mixture of Arabic and English (common in Egypt and Middle Eastern cancer centers).

CRITICAL INSTRUCTIONS:
1. Thoroughly inspect the prescription image. Read EVERY handwritten line.
2. EXCLUDE and IGNORE all clinic/hospital headers and footers, logos (e.g. Nile Badrawi, Cleocalfa, Cleopatra Hospitals), doctor name/signature/stamp, patient name, patient age, diagnosis/file numbers, addresses, phone hotlines (like 19668), and review dates.
3. EXTRACT all prescribed chemotherapy, immunotherapy, targeted therapy, monoclonal antibodies, cytotoxic agents, or supportive oncology drugs.
4. For EACH drug found in the prescription:
   - detectedName: The standard generic or brand name written (e.g., "Dostarlimab (Jemperli)", "Paclitaxel", "Carboplatin", "Keytruda (Pembrolizumab)", "Endoxan (Cyclophosphamide)", "Capecitabine (Xeloda)", "Oxaliplatin", "Gemcitabine", "MabThera", "Herceptin", etc.).
   - strength: E.g., "500 mg", "100 mg", "1 g", "20 mg/mL", etc.
   - dosage: Dose per cycle or administration (e.g., "500 mg IV infusion", "175 mg/m2", "300 mg").
   - frequency: Administration schedule (e.g., "Every 21 days", "q3w", "Day 1 every 28 days", "Day 1 and 8").
   - cycleCount: Total number of cycles or doses ordered in the prescription (e.g. if it says "عدد 3 جرعات" or "3 cycles", extract 3. If unspecified, use 1).
   - unitsPerCycle: How many vials, ampoules, tablets, or units are required per single cycle (e.g. 1 vial for 500 mg Dostarlimab; 3 vials for 300 mg Paclitaxel if 100 mg vials).
   - notes: Clinical remarks or directions (e.g., "Re-evaluation with PET scan after 3 doses", "premedication required", etc.).
   - originalText: Verbatim text from the prescription for this drug.
   - matchedMedicationHint: Best matching medication name from the provided pharmacy stock list if an exact or close match exists.

5. Also extract:
   - rawTranscription: Complete transcription of the clinical handwritten text on the paper.
   - languageDetected: "Arabic", "English", or "Mixed".
   - clinicalContext:
     - protocolSummary: 1-2 sentence description of the oncology protocol.
     - cycleDurationDays: number of days in the cycle interval (e.g., 21 if "كل 21 يوم").
     - totalCyclesPrescribed: total cycle count requested.
     - arabicNotesIgnored: List of administrative elements explicitly ignored.

Pharmacy Depot Stock List:
${stockSummary}

You MUST return ONLY valid JSON adhering strictly to this schema:
{
  "rawTranscription": string,
  "languageDetected": "Arabic" | "English" | "Mixed",
  "clinicalContext": {
    "protocolSummary": string,
    "cycleDurationDays": number,
    "totalCyclesPrescribed": number,
    "arabicNotesIgnored": string[]
  },
  "medications": [
    {
      "id": string,
      "originalText": string,
      "detectedName": string,
      "strength": string,
      "dosage": string,
      "frequency": string,
      "cycleCount": number,
      "unitsPerCycle": number,
      "notes": string,
      "matchedMedicationHint": string
    }
  ]
}`;

      // List of supported active vision models in order of precision and availability
      const modelsToTry = [
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3-flash-preview",
        "gemini-3.1-flash-lite",
      ];
      let lastError: any = null;
      let responseText: string | undefined;

      for (const modelName of modelsToTry) {
        // Try up to 2 attempts per model with slight jitter if 503 (high demand)
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    {
                      inlineData: {
                        mimeType,
                        data: pureBase64,
                      },
                    },
                  ],
                },
              ],
              config: {
                responseMimeType: "application/json",
                temperature: 0.1,
              },
            });

            if (response && response.text) {
              responseText = response.text;
              break;
            }
          } catch (err: any) {
            lastError = err;
            const status = err?.status || err?.code;
            console.warn(`Model ${modelName} (attempt ${attempt}) failed:`, err?.message || err);
            // If temporary 503 high demand, short delay before next attempt
            if ((status === 503 || String(err?.message).includes("503") || String(err?.message).includes("high demand")) && attempt === 1) {
              await new Promise((r) => setTimeout(r, 600));
            } else {
              break;
            }
          }
        }

        if (responseText) {
          break;
        }
      }

      if (!responseText) {
        throw new Error(lastError?.message || "Failed to receive response from Gemini vision model.");
      }

      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsedData = JSON.parse(cleanJson);
      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Error analyzing prescription:", error);
      return res.status(500).json({
        error: error.message || "Failed to analyze prescription image",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
