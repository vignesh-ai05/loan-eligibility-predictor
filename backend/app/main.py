from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.predict import router as predict_router
from app.config import APP_NAME, APP_VERSION

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="🏦 Loan Eligibility Predictor API with SHAP explanations",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(predict_router)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {APP_NAME}",
        "version": APP_VERSION,
        "docs":    "/docs",
        "status":  "running ✅",
    }


@app.get("/health")
def health():
    return {"status": "healthy", "model": "XGBoost loaded ✅"}