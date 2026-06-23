import pickle
import json
import numpy as np
import pandas as pd
import shap
from app.config import MODEL_PATH, FEATURES_PATH

# Load model and features once when server starts
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)

with open(FEATURES_PATH, "r") as f:
    feature_names = json.load(f)

explainer = shap.TreeExplainer(model)


def build_input_df(data: dict) -> pd.DataFrame:
    gender_map    = {"Male": 1, "Female": 0}
    married_map   = {"Yes": 1, "No": 0}
    education_map = {"Graduate": 1, "Not Graduate": 0}
    self_emp_map  = {"Yes": 1, "No": 0}
    property_map  = {"Urban": 2, "Semiurban": 1, "Rural": 0}

    dependents         = int(str(data.get("Dependents", "0")).replace("3+", "3"))
    applicant_income   = float(data["ApplicantIncome"])
    coapplicant_income = float(data["CoapplicantIncome"])
    loan_amount        = float(data["LoanAmount"])
    loan_term          = float(data["Loan_Amount_Term"])

    total_income      = applicant_income + coapplicant_income
    emi               = loan_amount / loan_term if loan_term > 0 else 0
    emi_income_ratio  = (emi * 1000) / total_income if total_income > 0 else 0
    loan_income_ratio = (loan_amount * 1000) / total_income if total_income > 0 else 0
    income_per_dep    = total_income / (dependents + 1)
    log_total_income  = np.log1p(total_income)
    log_loan_amount   = np.log1p(loan_amount)

    row = {
        "Gender":               gender_map.get(data.get("Gender", "Male"), 1),
        "Married":              married_map.get(data.get("Married", "No"), 0),
        "Dependents":           dependents,
        "Education":            education_map.get(data.get("Education", "Graduate"), 1),
        "Self_Employed":        self_emp_map.get(data.get("Self_Employed", "No"), 0),
        "ApplicantIncome":      applicant_income,
        "CoapplicantIncome":    coapplicant_income,
        "LoanAmount":           loan_amount,
        "Loan_Amount_Term":     loan_term,
        "Credit_History":       float(data.get("Credit_History", 1)),
        "Property_Area":        property_map.get(data.get("Property_Area", "Urban"), 2),
        "Total_Income":         total_income,
        "EMI":                  emi,
        "EMI_Income_Ratio":     emi_income_ratio,
        "Loan_Income_Ratio":    loan_income_ratio,
        "Income_Per_Dependent": income_per_dep,
        "Log_Total_Income":     log_total_income,
        "Log_LoanAmount":       log_loan_amount,
    }

    return pd.DataFrame([row])[feature_names]


def predict_loan(data: dict) -> dict:
    input_df    = build_input_df(data)
    prediction  = int(model.predict(input_df)[0])
    probability = float(model.predict_proba(input_df)[0][1])

    shap_vals  = explainer.shap_values(input_df)[0]
    shap_dict  = {
        feat: round(float(val), 4)
        for feat, val in zip(feature_names, shap_vals)
    }
    top_factors = sorted(shap_dict.items(), key=lambda x: abs(x[1]), reverse=True)[:5]

    if probability >= 0.75:
        risk_band = "Low Risk"
    elif probability >= 0.50:
        risk_band = "Medium Risk"
    else:
        risk_band = "High Risk"

    loan_amount_rs = float(data["LoanAmount"]) * 1000
    loan_term      = float(data["Loan_Amount_Term"])
    emi_monthly    = loan_amount_rs / loan_term if loan_term > 0 else 0

    return {
        "eligible":      prediction == 1,
        "prediction":    "Approved" if prediction == 1 else "Rejected",
        "probability":   round(probability * 100, 2),
        "risk_band":     risk_band,
        "emi_per_month": round(emi_monthly, 2),
        "shap_scores":   shap_dict,
        "top_factors":   [{"feature": k, "impact": v} for k, v in top_factors],
    }


def predict_batch(records: list) -> list:
    return [predict_loan(r) for r in records]


def what_if_analysis(data: dict, changes: dict) -> dict:
    original_result = predict_loan(data)
    modified_result = predict_loan({**data, **changes})
    return {
        "original": original_result,
        "modified": modified_result,
        "probability_change": round(
            modified_result["probability"] - original_result["probability"], 2
        ),
    }