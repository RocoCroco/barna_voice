import sqlite3
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib

def train_and_validate():
    print("1. Loading data from SQLite...")
    conn = sqlite3.connect("tv_logs.db")
    
    # Extract user_id, timestamp, action_type, and deeply nested genre
    query = """
        SELECT 
            user_id, 
            timestamp, 
            action_type, 
            json_extract(metadata, '$.genre') as genre 
        FROM activity_logs
    """
    df = pd.read_sql(query, conn)
    conn.close()

    if df.empty:
        print("Error: Database is empty. Run the seed script first.")
        return

    print("2. Engineering features...")
    # Filter for positive reinforcement (only learn from what they actually completed)
    df = df[df['action_type'] == 'content_completed'].copy()

    # Extract the hour of the day from the ISO timestamp
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.hour

    # Machine learning models need numbers, not strings. Encode the user IDs.
    user_encoder = LabelEncoder()
    df['user_encoded'] = user_encoder.fit_transform(df['user_id'])

    # Define our Features (X) and Target (y)
    X = df[['user_encoded', 'hour']]
    y = df['genre']

    print("3. Splitting into Train and Test sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("4. Training Random Forest Classifier...")
    model = RandomForestClassifier(n_estimators=50, random_state=42, max_depth=5)
    model.fit(X_train, y_train)

    print("5. Validating Model...")
    predictions = model.predict(X_test)
    accuracy = accuracy_score(y_test, predictions)
    print(f"-> Validation Accuracy: {accuracy * 100:.2f}%\n")

    print("6. Exporting model and encoders...")
    joblib.dump(model, "recommender_model.pkl")
    joblib.dump(user_encoder, "user_encoder.pkl")
    print("Done! Model saved as 'recommender_model.pkl'.")

if __name__ == "__main__":
    train_and_validate()
