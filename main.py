from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import joblib

app = FastAPI(title="CTV ML Recommender")

# Global variables for our ML components
ml_model = None
user_encoder = None

@app.on_event("startup")
def load_ml_assets():
    global ml_model, user_encoder
    try:
        ml_model = joblib.load("recommender_model.pkl")
        user_encoder = joblib.load("user_encoder.pkl")
        print("Machine Learning model loaded successfully.")
    except FileNotFoundError:
        print("Warning: ML model not found. Run train_model.py first.")

# SLNG will send this payload when invoking the tool
class SlngToolRequest(BaseModel):
    user_id: str
    current_time_iso: str = None  # Optional: allow SLNG to pass time, or infer it locally

@app.post("/api/tool/predict-genre")
def predict_user_genre(req: SlngToolRequest):
    """API Tool designed strictly to be called by the SLNG Voice Agent."""
    
    # 1. Handle unseen users gracefully
    if req.user_id not in user_encoder.classes_:
        return {
            "status": "cold_start", 
            "predicted_genre": "Action", # Fallback default
            "reason": "New user, reverting to popular catalog."
        }

    # 2. Prepare the features
    user_encoded = user_encoder.transform([req.user_id])[0]
    
    if req.current_time_iso:
        hour = datetime.fromisoformat(req.current_time_iso.replace("Z", "+00:00")).hour
    else:
        hour = datetime.utcnow().hour

    # 3. Execute ML Inference
    predicted_genre = ml_model.predict([[user_encoded, hour]])[0]

    return {
        "status": "success",
        "user_id": req.user_id,
        "context_hour": hour,
        "predicted_genre": predicted_genre
    }