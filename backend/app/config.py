from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "loan_model.pkl"
FEATURES_PATH = BASE_DIR / "models" / "feature_names.json"

APP_NAME = "Loan Eligibility Predictor API"
APP_VERSION = "1.0.0"
DEBUG = True