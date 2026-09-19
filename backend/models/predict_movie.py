# models/predict_movie.py
import sqlite3
from pathlib import Path
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib

MODELS_DIR = Path(__file__).resolve().parent
DB_NAME = str(MODELS_DIR.parent / "db" / "tv_logs.db")


def train_and_validate():
    print("1. Loading data from SQLite...")
    conn = sqlite3.connect(DB_NAME)
    query = """
        SELECT
            user_id,
            timestamp,
            action_type,
            json_extract(metadata, '$.genre')      AS genre,
            json_extract(metadata, '$.title')      AS title
        FROM activity_logs
    """
    df = pd.read_sql(query, conn)
    conn.close()

    if df.empty:
        print("Error: Database is empty. Run the seed script first.")
        return

    print("2. Engineering features...")
    df = df[df["action_type"] == "content_completed"].copy()
    df = df.dropna(subset=["genre", "title"])

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour"] = df["timestamp"].dt.hour

    user_encoder = LabelEncoder()
    genre_encoder = LabelEncoder()
    df["user_encoded"] = user_encoder.fit_transform(df["user_id"])
    df["genre_encoded"] = genre_encoder.fit_transform(df["genre"])

    # Predict the movie the user finishes given who they are + the target genre
    X = df[["user_encoded", "genre_encoded", "hour"]]
    y = df["title"]

    print("3. Splitting into Train and Test sets...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("4. Training Random Forest Classifier...")
    model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=8)
    model.fit(X_train, y_train)

    print("5. Validating Model...")
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"-> Validation Accuracy: {accuracy * 100:.2f}%\n")

    print("6. Exporting model and encoders...")
    joblib.dump(model, MODELS_DIR / "predict_movie_model.pkl")
    joblib.dump(user_encoder, MODELS_DIR / "predict_movie_user_encoder.pkl")
    joblib.dump(genre_encoder, MODELS_DIR / "predict_movie_genre_encoder.pkl")
    print("Done! Model saved as 'predict_movie_model.pkl'.")


if __name__ == "__main__":
    train_and_validate()
