from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deep_translator import GoogleTranslator  # <-- NEW IMPORT
import pickle
import re

# Initialize the API
app = FastAPI(title="Telehealth Risk Triage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

# Load models globally on startup
try:
    model = pickle.load(open("risk_model.pkl", "rb"))
    vectorizer = pickle.load(open("vectorizer.pkl", "rb"))
except FileNotFoundError:
    print("Error: Ensure risk_model.pkl and vectorizer.pkl are in the same folder as main.py.")

class SymptomInput(BaseModel):
    symptoms: str

def clean_text(text: str) -> str:
    text = re.sub(r"[^a-z ]", " ", text.lower())
    text = re.sub(r"\s+", " ", text).strip()
    return text
    
@app.post("/predict")
def predict_risk(data: SymptomInput):
    if not data.symptoms.strip():
        raise HTTPException(status_code=400, detail="Symptoms cannot be empty.")
        
    # --- UPGRADE 1: Translation Layer (Hindi to English) ---
    try:
        # Detects language automatically and translates to English
        translated_text = GoogleTranslator(source='auto', target='en').translate(data.symptoms)
    except Exception:
        # Fallback just in case the translation fails
        translated_text = data.symptoms
        
    # Process the translated text
    cleaned = clean_text(translated_text)
    words = cleaned.split()
    
    # Require more context (Prevents single-word errors)
    if len(words) < 2:
        return {
            "symptoms": data.symptoms,
            "risk_level": "insufficient_data",
            "message": "Please describe your symptoms in more detail."
        }

    vec = vectorizer.transform([cleaned])
    
    if vec.nnz == 0:
        return {
            "symptoms": data.symptoms,
            "risk_level": "unknown",
            "message": "Symptoms not recognized. Please check your spelling and provide more details."
        }
    
    # ML Prediction
    result = model.predict(vec)[0]
    
    # --- UPGRADE 2: Hybrid Critical Safety Net ---
    if result == "high":
        # If model says high, check for emergency keywords in the English translation
        critical_keywords = ["chest", "jaw", "stroke", "unconscious", "breath", "faint"]
        if any(keyword in cleaned for keyword in critical_keywords):
            result = "critical" # Upgrade the risk!
    
    return {
        "original_input": data.symptoms,
        "translated_and_cleaned": cleaned,
        "risk_level": result
    }