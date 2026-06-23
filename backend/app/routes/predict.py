from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List
from app.utils.predictor import predict_loan, predict_batch, what_if_analysis

router = APIRouter(prefix="/api", tags=["Predictions"])


class LoanApplication(BaseModel):
    Gender:            str   = Field(..., example="Male")
    Married:           str   = Field(..., example="Yes")
    Dependents:        str   = Field(..., example="0")
    Education:         str   = Field(..., example="Graduate")
    Self_Employed:     str   = Field(..., example="No")
    ApplicantIncome:   float = Field(..., example=5000)
    CoapplicantIncome: float = Field(..., example=1500)
    LoanAmount:        float = Field(..., example=120)
    Loan_Amount_Term:  float = Field(..., example=360)
    Credit_History:    float = Field(..., example=1.0)
    Property_Area:     str   = Field(..., example="Urban")


class WhatIfRequest(BaseModel):
    application: LoanApplication
    changes:     dict


@router.post("/predict")
def single_predict(application: LoanApplication):
    try:
        result = predict_loan(application.dict())
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict/batch")
def batch_predict(applications: List[LoanApplication]):
    try:
        results  = predict_batch([a.dict() for a in applications])
        approved = sum(1 for r in results if r["eligible"])
        return {
            "status":   "success",
            "total":    len(results),
            "approved": approved,
            "rejected": len(results) - approved,
            "results":  results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatif")
def whatif(request: WhatIfRequest):
    try:
        result = what_if_analysis(request.application.dict(), request.changes)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/banks")
def multi_bank_comparison(
    income: float,
    loan_amount: float,
    credit_history: float,
    loan_term: float = 360
):
    banks = [
        {"name": "SBI",   "income_min": 3000, "ltv_max": 0.85, "credit_required": True},
        {"name": "HDFC",  "income_min": 4000, "ltv_max": 0.80, "credit_required": True},
        {"name": "ICICI", "income_min": 3500, "ltv_max": 0.90, "credit_required": False},
        {"name": "Axis",  "income_min": 2500, "ltv_max": 0.75, "credit_required": True},
    ]
    results = []
    for bank in banks:
        ltv      = (loan_amount * 1000) / (income * 12) if income > 0 else 999
        approved = (
            income >= bank["income_min"]
            and ltv <= bank["ltv_max"]
            and (not bank["credit_required"] or credit_history == 1.0)
        )
        results.append({
            "bank":     bank["name"],
            "approved": approved,
            "reason":   "Meets all criteria" if approved else
                        ("Low income" if income < bank["income_min"] else
                         "High LTV ratio" if ltv > bank["ltv_max"] else
                         "Credit history required"),
        })
    return {"status": "success", "data": results}