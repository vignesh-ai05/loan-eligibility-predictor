import { useState } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import {
  CheckCircle, XCircle, AlertTriangle,
  TrendingUp, Building2, Sliders, FileText
} from "lucide-react";

const API = "http://127.0.0.1:8000/api";

const DEFAULT_FORM = {
  Gender: "Male", Married: "Yes", Dependents: "0",
  Education: "Graduate", Self_Employed: "No",
  ApplicantIncome: 5000, CoapplicantIncome: 1500,
  LoanAmount: 120, Loan_Amount_Term: 360,
  Credit_History: 1.0, Property_Area: "Urban",
};

// ── Gauge SVG ──────────────────────────────────────────────
function Gauge({ value }) {
  const pct   = Math.min(Math.max(value, 0), 100);
  const angle = -135 + (pct / 100) * 270;
  const color = pct >= 75 ? "#34d399" : pct >= 50 ? "#fbbf24" : "#f87171";
  const r = 70, cx = 90, cy = 90;
  const toXY = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = toXY(-135);
  const end   = toXY(135);
  const needle = toXY(angle);
  return (
    <svg width="180" height="120" viewBox="0 0 180 120">
      <path d={`M${start.x},${start.y} A${r},${r} 0 1 1 ${end.x},${end.y}`}
        fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round" />
      <path d={`M${start.x},${start.y} A${r},${r} 0 1 1 ${end.x},${end.y}`}
        fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * 220 * Math.PI / 3} 999`} />
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y}
        stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="white" />
      <text x={cx} y={108} textAnchor="middle"
        fill={color} fontSize="20" fontWeight="bold">{pct}%</text>
    </svg>
  );
}

// ── SHAP Bar Chart ──────────────────────────────────────────
function ShapChart({ factors }) {
  const data = factors.map((f) => ({
    name: f.feature.replace(/_/g, " "),
    value: Math.abs(f.impact),
    raw: f.impact,
  }));
  return (
    <div>
      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>
        Top factors affecting this decision:
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis dataKey="name" type="category"
            tick={{ fill: "#cbd5e1", fontSize: 11 }} width={140} />
          <Tooltip
            formatter={(v, n, p) => [
              p.payload.raw > 0 ? `+${p.payload.raw.toFixed(3)}` : p.payload.raw.toFixed(3),
              "SHAP Impact"
            ]}
            contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.raw > 0 ? "#34d399" : "#f87171"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
        🟢 Green = helps approval &nbsp; 🔴 Red = hurts approval
      </p>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]         = useState("predict");
  const [form, setForm]       = useState(DEFAULT_FORM);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // What-if state
  const [wiIncome, setWiIncome]   = useState(5000);
  const [wiLoan, setWiLoan]       = useState(120);
  const [wiResult, setWiResult]   = useState(null);
  const [wiLoading, setWiLoading] = useState(false);

  // Bank comparison state
  const [banks, setBanks]           = useState(null);
  const [bankLoading, setBankLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // ── Predict ──
  async function handlePredict() {
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await axios.post(`${API}/predict`, form);
      setResult(data.data);
    } catch (e) {
      setError("❌ API error: " + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  }

  // ── What-if ──
  async function handleWhatIf() {
    setWiLoading(true); setWiResult(null);
    try {
      const { data } = await axios.post(`${API}/whatif`, {
        application: form,
        changes: { ApplicantIncome: wiIncome, LoanAmount: wiLoan },
      });
      setWiResult(data.data);
    } catch (e) { console.error(e); }
    setWiLoading(false);
  }

  // ── Bank Comparison ──
  async function handleBanks() {
    setBankLoading(true); setBanks(null);
    try {
      const { data } = await axios.get(`${API}/banks`, {
        params: {
          income: form.ApplicantIncome,
          loan_amount: form.LoanAmount,
          credit_history: form.Credit_History,
          loan_term: form.Loan_Amount_Term,
        },
      });
      setBanks(data.data);
    } catch (e) { console.error(e); }
    setBankLoading(false);
  }

  // ── PDF Report ──
  function downloadReport() {
    if (!result) return;
    const lines = [
      "LOAN ELIGIBILITY REPORT",
      "========================",
      `Decision     : ${result.prediction}`,
      `Probability  : ${result.probability}%`,
      `Risk Band    : ${result.risk_band}`,
      `EMI/Month    : ₹${result.emi_per_month}`,
      "",
      "TOP FACTORS:",
      ...result.top_factors.map(
        (f) => `  ${f.feature}: ${f.impact > 0 ? "+" : ""}${f.impact}`
      ),
      "",
      "INPUT DETAILS:",
      ...Object.entries(form).map(([k, v]) => `  ${k}: ${v}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "loan_report.txt"; a.click();
  }

  // ── Loan Form ──
  const LoanForm = () => (
    <div className="card">
      <h2 style={{ marginBottom: 20, fontSize: 18 }}>📋 Applicant Details</h2>
      <div className="grid-3">
        <div className="form-group">
          <label>Gender</label>
          <select value={form.Gender} onChange={e => set("Gender", e.target.value)}>
            <option>Male</option><option>Female</option>
          </select>
        </div>
        <div className="form-group">
          <label>Married</label>
          <select value={form.Married} onChange={e => set("Married", e.target.value)}>
            <option>Yes</option><option>No</option>
          </select>
        </div>
        <div className="form-group">
          <label>Dependents</label>
          <select value={form.Dependents} onChange={e => set("Dependents", e.target.value)}>
            <option>0</option><option>1</option><option>2</option><option>3+</option>
          </select>
        </div>
        <div className="form-group">
          <label>Education</label>
          <select value={form.Education} onChange={e => set("Education", e.target.value)}>
            <option>Graduate</option><option>Not Graduate</option>
          </select>
        </div>
        <div className="form-group">
          <label>Self Employed</label>
          <select value={form.Self_Employed} onChange={e => set("Self_Employed", e.target.value)}>
            <option>No</option><option>Yes</option>
          </select>
        </div>
        <div className="form-group">
          <label>Property Area</label>
          <select value={form.Property_Area} onChange={e => set("Property_Area", e.target.value)}>
            <option>Urban</option><option>Semiurban</option><option>Rural</option>
          </select>
        </div>
        <div className="form-group">
          <label>Applicant Income (₹)</label>
          <input type="number" value={form.ApplicantIncome}
            onChange={e => set("ApplicantIncome", +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Co-applicant Income (₹)</label>
          <input type="number" value={form.CoapplicantIncome}
            onChange={e => set("CoapplicantIncome", +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Loan Amount (₹ thousands)</label>
          <input type="number" value={form.LoanAmount}
            onChange={e => set("LoanAmount", +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Loan Term (months)</label>
          <input type="number" value={form.Loan_Amount_Term}
            onChange={e => set("Loan_Amount_Term", +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Credit History</label>
          <select value={form.Credit_History}
            onChange={e => set("Credit_History", +e.target.value)}>
            <option value={1}>Good (1.0)</option>
            <option value={0}>Bad (0.0)</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#a5b4fc" }}>
          🏦 Loan Eligibility Predictor
        </h1>
        <p style={{ color: "#64748b", marginTop: 6 }}>
          AI-powered decisions with full explainability
        </p>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[
          { id: "predict", icon: <TrendingUp size={14}/>, label: "Predict" },
          { id: "whatif",  icon: <Sliders size={14}/>,    label: "What-If" },
          { id: "banks",   icon: <Building2 size={14}/>,  label: "Banks" },
          { id: "report",  icon: <FileText size={14}/>,   label: "Report" },
        ].map(t => (
          <button key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PREDICT ── */}
      {tab === "predict" && (
        <>
          <LoanForm />
          {error && (
            <div style={{ color: "#f87171", marginBottom: 16, padding: 12,
              background: "#2d0a0a", borderRadius: 8 }}>{error}</div>
          )}
          <button className="btn-primary" onClick={handlePredict} disabled={loading}>
            {loading ? "⏳ Analysing..." : "🔍 Check Eligibility"}
          </button>

          {result && (
            <div style={{ marginTop: 24 }}>
              <div className={result.eligible ? "result-approved" : "result-rejected"}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>
                  {result.eligible ? "✅" : "❌"}
                </div>
                <h2 style={{ fontSize: 24, marginBottom: 4 }}>
                  Loan {result.prediction}
                </h2>
                <div className="gauge-wrap">
                  <Gauge value={result.probability} />
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className={`badge ${result.eligible ? "badge-green" : "badge-red"}`}>
                    {result.risk_band}
                  </span>
                  <span className="badge badge-blue">
                    EMI ₹{result.emi_per_month}/month
                  </span>
                </div>
              </div>

              <div className="card" style={{ marginTop: 20 }}>
                <h3 style={{ marginBottom: 16 }}>🔬 Why this decision?</h3>
                <ShapChart factors={result.top_factors} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: WHAT-IF ── */}
      {tab === "whatif" && (
        <>
          <div className="card">
            <h2 style={{ marginBottom: 20, fontSize: 18 }}>
              🎛️ What-If Simulator
            </h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
              Adjust income and loan amount to see how your chances change.
              Fill the form in Predict tab first, then come here.
            </p>
            <div className="slider-wrap">
              <label>
                <span>Monthly Income</span>
                <span style={{ color: "#a5b4fc", fontWeight: 600 }}>
                  ₹{wiIncome.toLocaleString()}
                </span>
              </label>
              <input type="range" min={1000} max={30000} step={500}
                value={wiIncome} onChange={e => setWiIncome(+e.target.value)} />
            </div>
            <div className="slider-wrap">
              <label>
                <span>Loan Amount (₹ thousands)</span>
                <span style={{ color: "#a5b4fc", fontWeight: 600 }}>
                  ₹{(wiLoan * 1000).toLocaleString()}
                </span>
              </label>
              <input type="range" min={10} max={500} step={10}
                value={wiLoan} onChange={e => setWiLoan(+e.target.value)} />
            </div>
            <button className="btn-primary" onClick={handleWhatIf} disabled={wiLoading}>
              {wiLoading ? "⏳ Simulating..." : "⚡ Run Simulation"}
            </button>
          </div>

          {wiResult && (
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Simulation Results</h3>
              <div className="grid-2">
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#94a3b8", marginBottom: 8 }}>Original</p>
                  <Gauge value={wiResult.original.probability} />
                  <span className={`badge ${wiResult.original.eligible ? "badge-green" : "badge-red"}`}>
                    {wiResult.original.prediction}
                  </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#94a3b8", marginBottom: 8 }}>Simulated</p>
                  <Gauge value={wiResult.modified.probability} />
                  <span className={`badge ${wiResult.modified.eligible ? "badge-green" : "badge-red"}`}>
                    {wiResult.modified.prediction}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 16 }}>
                <span className={`badge ${wiResult.probability_change >= 0 ? "badge-green" : "badge-red"}`}>
                  {wiResult.probability_change >= 0 ? "▲" : "▼"} 
                  {Math.abs(wiResult.probability_change)}% change
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: BANKS ── */}
      {tab === "banks" && (
        <>
          <div className="card">
            <h2 style={{ marginBottom: 8, fontSize: 18 }}>🏦 Multi-Bank Comparison</h2>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
              See which banks would approve your loan based on current form values.
            </p>
            <button className="btn-primary" onClick={handleBanks} disabled={bankLoading}>
              {bankLoading ? "⏳ Checking banks..." : "🔎 Compare Banks"}
            </button>
          </div>

          {banks && (
            <div className="card">
              <h3 style={{ marginBottom: 16 }}>Bank Decisions</h3>
              {banks.map((b, i) => (
                <div className="bank-row" key={i}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{b.bank} Bank</p>
                    <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {b.reason}
                    </p>
                  </div>
                  <span className={`badge ${b.approved ? "badge-green" : "badge-red"}`}>
                    {b.approved ? "✅ Approved" : "❌ Rejected"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: REPORT ── */}
      {tab === "report" && (
        <div className="card">
          <h2 style={{ marginBottom: 8, fontSize: 18 }}>📄 Download Report</h2>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
            Run a prediction first in the Predict tab, then download your full report here.
          </p>
          {result ? (
            <>
              <div style={{ background: "#0f172a", borderRadius: 8,
                padding: 16, marginBottom: 20, fontFamily: "monospace", fontSize: 13 }}>
                <p>Decision    : <strong style={{ color: result.eligible ? "#34d399" : "#f87171" }}>
                  {result.prediction}</strong></p>
                <p>Probability : {result.probability}%</p>
                <p>Risk Band   : {result.risk_band}</p>
                <p>EMI/Month   : ₹{result.emi_per_month}</p>
              </div>
              <button className="btn-primary" onClick={downloadReport}>
                ⬇️ Download Report
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>
              <AlertTriangle size={40} style={{ marginBottom: 12 }} />
              <p>No prediction yet. Go to the Predict tab first!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}