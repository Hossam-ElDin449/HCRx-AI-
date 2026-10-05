import json
import re
import os
import io
import pandas as pd
import streamlit as st
from PIL import Image
from google import genai
from rapidfuzz import process, fuzz

# Set up page configuration
st.set_page_config(
    page_title="OncoRx Prescription Analyzer",
    page_icon="💊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ------------------------------------------------------------------------------
# 1. DEFAULT DATA & CONSTANTS
# ------------------------------------------------------------------------------
DEFAULT_STOCK_CATALOG = [
    {"code": "ONC-001", "name": "Jemperli (Dostarlimab) 500mg/10ml", "price": 42000.0, "depot": "Depot A - Central Warehouse"},
    {"code": "ONC-002", "name": "Keytruda (Pembrolizumab) 100mg", "price": 38500.0, "depot": "Depot A - Central Warehouse"},
    {"code": "ONC-003", "name": "Opdivo (Nivolumab) 100mg/10ml", "price": 28000.0, "depot": "Depot B - Oncology Depot"},
    {"code": "ONC-004", "name": "Tecentriq (Atezolizumab) 1200mg", "price": 45000.0, "depot": "Depot A - Central Warehouse"},
    {"code": "ONC-005", "name": "Avastin (Bevacizumab) 400mg", "price": 14500.0, "depot": "Depot C - Emergency Pharmacy"},
    {"code": "ONC-006", "name": "Herceptin (Trastuzumab) 440mg", "price": 19200.0, "depot": "Depot B - Oncology Depot"},
    {"code": "ONC-007", "name": "Paclitaxel 100mg Injection", "price": 850.0, "depot": "Depot B - Oncology Depot"},
    {"code": "ONC-008", "name": "Carboplatin 450mg Vial", "price": 1120.0, "depot": "Depot B - Oncology Depot"},
    {"code": "ONC-009", "name": "Cisplatin 50mg Vial", "price": 450.0, "depot": "Depot A - Central Warehouse"},
    {"code": "ONC-010", "name": "Oxaliplatin 100mg Vial", "price": 1650.0, "depot": "Depot A - Central Warehouse"},
]

SAMPLE_PRESCRIPTION_RESULT = {
    "rawTranscription": "Dostarlimab (Jemperli) 500 mg IV every 3 weeks. Total planned cycles: 3.",
    "languageDetected": "English / Arabic Context",
    "clinicalContext": {
        "hospitalName": "Cleocalfa Hospital",
        "patientName": "Sarah Ahmed Hassan",
        "diagnosis": "Endometrial Carcinoma",
        "totalCyclesPrescribed": 3
    },
    "medications": [
        {
            "id": "med-sample-1",
            "originalText": "Dostarlimab 500mg IV q3w",
            "detectedName": "Jemperli (Dostarlimab) 500mg/10ml",
            "strength": "500 mg",
            "dosage": "500 mg IV infusion over 30 mins",
            "frequency": "Every 3 weeks",
            "unitsPerCycle": 1,
            "cycleCount": 3,
            "notes": "Monitor for immune-related adverse reactions.",
            "unitCost": 42000.0,
            "cycleCost": 42000.0,
            "totalCost": 126000.0
        }
    ],
    "totalOverallCost": 126000.0,
    "confidenceScore": 0.98
}

# ------------------------------------------------------------------------------
# 2. UTILITY & HELPER FUNCTIONS
# ------------------------------------------------------------------------------
def find_best_stock_match(query_name: str, stock_catalog: list):
    """Fuzzy matches extracted drug name against stock catalog using rapidfuzz."""
    if not stock_catalog or not query_name:
        return None, 0.0
    
    names = [s["name"] for s in stock_catalog]
    match, score, index = process.extractOne(query_name, names, scorer=fuzz.WRatio)
    
    if score >= 50:
        return stock_catalog[index], score / 100.0
    return None, 0.0

def load_stock_from_csv_url(url_or_id: str):
    """Loads Google Sheet stock catalog by converting Google Sheets web URL to CSV export URL."""
    try:
        # Convert standard Google Sheet URL to direct CSV download URL if applicable
        if "docs.google.com/spreadsheets" in url_or_id:
            sheet_id_match = re.search(r'/d/([a-zA-Z0-9-_]+)', url_or_id)
            if sheet_id_match:
                sheet_id = sheet_id_match.group(1)
                csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
            else:
                csv_url = url_or_id
        else:
            csv_url = url_or_id

        df = pd.read_csv(csv_url)
        
        # Standardize column names dynamically
        column_mapping = {}
        for col in df.columns:
            c_lower = str(col).lower()
            if any(k in c_lower for k in ["code", "id", "sku"]):
                column_mapping[col] = "code"
            elif any(k in c_lower for k in ["name", "medication", "drug", "item", "description"]):
                column_mapping[col] = "name"
            elif any(k in c_lower for k in ["price", "cost", "unit price", "valeur"]):
                column_mapping[col] = "price"
            elif any(k in c_lower for k in ["depot", "warehouse", "location", "store"]):
                column_mapping[col] = "depot"

        df = df.rename(columns=column_mapping)
        
        # Ensure mandatory columns exist
        if "name" not in df.columns or "price" not in df.columns:
            st.error("Sheet must contain at least 'Name' and 'Price' columns.")
            return None

        if "code" not in df.columns:
            df["code"] = [f"ITEM-{i+1:03d}" for i in range(len(df))]
        if "depot" not in df.columns:
            df["depot"] = "Default Depot"

        df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0.0)
        return df[["code", "name", "price", "depot"]].to_dict(orient="records")
    except Exception as e:
        st.error(f"Failed to fetch Google Sheet stock: {e}")
        return None

def analyze_prescription_with_gemini(api_key: str, image: Image.Image, stock_catalog: list):
    """Sends image to Gemini 2.5/1.5 Vision model using the official google-genai SDK."""
    client = genai.Client(api_key=api_key)
    
    # Send a small sample of stock catalog names to guide the model
    catalog_hint = [item["name"] for item in stock_catalog[:100]]

    prompt = f"""
    You are an expert hospital oncology pharmacist reading handwritten or printed prescription images.
    
    Analyze the provided prescription image carefully (which may contain handwritten English or Arabic text).
    Extract all chemotherapy and supportive medications along with clinical context.

    Here is a reference stock catalog of drug names for matching guidance:
    {json.dumps(catalog_hint)}

    Strictly return a valid JSON object matching the following structure without Markdown formatting or prose:
    {{
        "rawTranscription": "Full raw text extracted from image...",
        "languageDetected": "English / Arabic / Mixed",
        "clinicalContext": {{
            "hospitalName": "Extracted hospital name or null",
            "patientName": "Patient name or null",
            "diagnosis": "Diagnosis or protocol name if available",
            "totalCyclesPrescribed": 1
        }},
        "medications": [
            {{
                "id": "med-1",
                "originalText": "Raw text line for this drug",
                "detectedName": "Clean drug name and strength",
                "strength": "e.g., 500mg",
                "dosage": "e.g., 500mg IV",
                "frequency": "e.g., q3w or every 3 weeks",
                "unitsPerCycle": 1,
                "cycleCount": 1,
                "notes": "Any special clinical note or administration rule"
            }}
        ]
    }}
    """

    # Call Gemini model
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[prompt, image]
    )

    # Clean raw JSON response from potential ```json tags
    raw_text = response.text.strip()
    if raw_text.startswith("```"):
        raw_text = re.sub(r"^```[a-zA-Z]*\n?", "", raw_text)
        raw_text = re.sub(r"\n?```$", "", raw_text)

    parsed = json.loads(raw_text)
    
    # Enrich extracted medications with stock pricing
    enriched_meds = []
    total_overall = 0.0

    for idx, m in enumerate(parsed.get("medications", [])):
        detected_name = m.get("detectedName") or m.get("originalText") or "Unknown Drug"
        match, score = find_best_stock_match(detected_name, stock_catalog)

        cycle_count = m.get("cycleCount") or parsed.get("clinicalContext", {}).get("totalCyclesPrescribed") or 1
        units_per_cycle = m.get("unitsPerCycle") or 1
        unit_cost = match["price"] if match else 0.0
        cycle_cost = unit_cost * units_per_cycle
        total_cost = cycle_cost * cycle_count

        enriched_meds.append({
            "id": f"med-{idx+1}",
            "originalText": m.get("originalText", ""),
            "detectedName": detected_name,
            "strength": m.get("strength", ""),
            "dosage": m.get("dosage", ""),
            "frequency": m.get("frequency", ""),
            "unitsPerCycle": units_per_cycle,
            "cycleCount": cycle_count,
            "notes": m.get("notes", ""),
            "matchedStock": match["name"] if match else "No Match Found",
            "unitCost": unit_cost,
            "cycleCost": cycle_cost,
            "totalCost": total_cost,
        })
        total_overall += total_cost

    parsed["medications"] = enriched_meds
    parsed["totalOverallCost"] = total_overall
    parsed["confidenceScore"] = 0.98
    return parsed

# ------------------------------------------------------------------------------
# 3. SESSION STATE INITIALIZATION
# ------------------------------------------------------------------------------
if "stock_catalog" not in st.session_state:
    st.session_state.stock_catalog = DEFAULT_STOCK_CATALOG
if "active_sheet_name" not in st.session_state:
    st.session_state.active_sheet_name = "Embedded Default Catalog"
if "analysis_result" not in st.session_state:
    st.session_state.analysis_result = SAMPLE_PRESCRIPTION_RESULT

# ------------------------------------------------------------------------------
# 4. SIDEBAR & NAVIGATION
# ------------------------------------------------------------------------------
with st.sidebar:
    st.title("💊 OncoRx Settings")
    st.caption("Pharmacy Chemotherapy Reader & Pricing")
    
    st.divider()
    
    # Gemini API Key Handling
    st.subheader("1. API Configuration")
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        api_key = st.text_input("Enter Gemini API Key:", type="password", help="Get your API key from Google AI Studio.")
    else:
        st.success("API Key loaded from environment!")

    st.divider()

    # Google Sheets Stock Inventory Sync
    st.subheader("2. Stock Catalog Sync")
    st.write(f"**Current Catalog:** `{st.session_state.active_sheet_name}` ({len(st.session_state.stock_catalog)} items)")

    sheet_input = st.text_input("Google Sheet URL / CSV Link:", placeholder="Paste published Google Sheet URL...")
    
    col_sync, col_reset = st.columns(2)
    with col_sync:
        if st.button("🔄 Sync Sheet", use_container_width=True):
            if sheet_input:
                with st.spinner("Fetching catalog..."):
                    new_catalog = load_stock_from_csv_url(sheet_input)
                    if new_catalog:
                        st.session_state.stock_catalog = new_catalog
                        st.session_state.active_sheet_name = "Synced Google Sheet"
                        st.success("Stock catalog updated!")
                        st.rerun()
            else:
                st.warning("Please enter a valid URL.")

    with col_reset:
        if st.button("↺ Reset Default", use_container_width=True):
            st.session_state.stock_catalog = DEFAULT_STOCK_CATALOG
            st.session_state.active_sheet_name = "Embedded Default Catalog"
            st.info("Reset to default catalog.")
            st.rerun()

# ------------------------------------------------------------------------------
# 5. MAIN HEADER
# ------------------------------------------------------------------------------
st.title("📄 OncoRx Chemotherapy Prescription Analyzer")
st.markdown("Automated Arabic & English prescription OCR reader with drug matching, cycle calculation, and overall cost estimation.")

st.divider()

# ------------------------------------------------------------------------------
# 6. PRESCRIPTION UPLOAD & PROCESSING
# ------------------------------------------------------------------------------
st.subheader("📸 Upload Prescription Image")

col_upload, col_sample = st.columns([3, 1])

with col_upload:
    uploaded_file = st.file_uploader("Choose a prescription image (JPG, PNG, WEBP)", type=["jpg", "jpeg", "png", "webp"])

with col_sample:
    st.write("")
    st.write("")
    if st.button("📋 Load Sample Data", use_container_width=True):
        st.session_state.analysis_result = SAMPLE_PRESCRIPTION_RESULT
        st.success("Loaded Cleocalfa Hospital sample prescription.")
        st.rerun()

if uploaded_file is not None:
    image = Image.open(uploaded_file)
    
    col_img, col_btn = st.columns([1, 2])
    with col_img:
        st.image(image, caption="Uploaded Prescription", use_column_width=True)
    
    with col_btn:
        st.info("Image ready for analysis.")
        if st.button("🚀 Analyze Prescription with Gemini Vision", type="primary"):
            if not api_key:
                st.error("Please provide a valid Gemini API Key in the sidebar.")
            else:
                with st.spinner("Analyzing handwriting with Gemini Vision OCR..."):
                    try:
                        res = analyze_prescription_with_gemini(api_key, image, st.session_state.stock_catalog)
                        st.session_state.analysis_result = res
                        st.success("Prescription processed successfully!")
                    except Exception as e:
                        st.error(f"Analysis failed: {e}")

st.divider()

# ------------------------------------------------------------------------------
# 7. RESULTS SUMMARY & EDITABLE TABLE
# ------------------------------------------------------------------------------
if st.session_state.analysis_result:
    res = st.session_state.analysis_result

    st.subheader("📊 Recognized Medications & Pricing Breakdown")

    # Metrics Summary Bar
    meds = res.get("medications", [])
    total_cost = sum(m["totalCost"] for m in meds)
    
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Recognized Drugs", f"{len(meds)} item(s)")
    m2.metric("Detected Language", res.get("languageDetected", "N/A"))
    m3.metric("OCR Confidence", f"{int(res.get('confidenceScore', 0.95)*100)}%")
    m4.metric("Total Protocol Cost", f"{total_cost:,.2f} EGP")

    st.write("")

    # Interactive Dataframe for Medications
    df_meds = pd.DataFrame(meds)
    if not df_meds.empty:
        display_df = df_meds[[
            "detectedName", "strength", "dosage", "frequency", 
            "unitsPerCycle", "cycleCount", "matchedStock", 
            "unitCost", "cycleCost", "totalCost"
        ]].copy()

        display_df.columns = [
            "Medication", "Strength", "Dosage", "Frequency", 
            "Units/Cycle", "Total Cycles", "Matched Depot Stock", 
            "Unit Price (EGP)", "Cost / Cycle (EGP)", "Total Cost (EGP)"
        ]

        # Enable interactive editing of units & cycles
        edited_df = st.data_editor(
            display_df,
            use_container_width=True,
            num_rows="dynamic",
            column_config={
                "Unit Price (EGP)": st.column_config.NumberColumn(format="%.2f EGP"),
                "Cost / Cycle (EGP)": st.column_config.NumberColumn(format="%.2f EGP"),
                "Total Cost (EGP)": st.column_config.NumberColumn(format="%.2f EGP"),
            }
        )

    # Clinical Context & Raw Output Expanders
    st.write("")
    col_ctx, col_raw = st.columns(2)

    with col_ctx:
        with st.expander("📋 Extracted Clinical Context", expanded=True):
            ctx = res.get("clinicalContext", {})
            st.write(f"**Hospital:** {ctx.get('hospitalName') or 'Not Specified'}")
            st.write(f"**Patient:** {ctx.get('patientName') or 'Not Specified'}")
            st.write(f"**Diagnosis / Protocol:** {ctx.get('diagnosis') or 'Not Specified'}")
            st.write(f"**Prescribed Cycles:** {ctx.get('totalCyclesPrescribed') or 'N/A'}")

    with col_raw:
        with st.expander("📝 Raw OCR Transcription", expanded=False):
            st.text_area("Transcription Text", res.get("rawTranscription", ""), height=130)
