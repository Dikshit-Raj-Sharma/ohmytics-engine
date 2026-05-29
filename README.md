# OHMYTICS ENGINE
### LiFePO₄ Battery Management System · RLS State Estimator · Digital Twin

A full-stack Battery Management System that uses a **Recursive Least Squares (RLS) adaptive estimator** to predict real-time State of Charge (SoC) of a LiFePO₄ EV battery. Sensor telemetry streams from a simulated highway drive through a Node.js backend, through a Python RLS engine, into a MySQL database, and out to a live React dashboard over WebSockets.

---

## What It Does

A traditional BMS uses physics-based Coulomb counting to track SoC — it integrates current over time and drifts with sensor error. This project replaces that with an online machine learning approach: **RLS** learns the mapping between battery inputs (voltage, current, temperature) and SoC recursively, updating its internal weight matrix on every single sample without storing history.

The result is a self-correcting estimator that starts with a bad initial guess (50%) and converges toward ground truth within a few hundred samples, live, on the dashboard.

---

## Architecture

```
ev_streamer.js          server.js            rls_engine.py
──────────────    →    ───────────    →     ───────────────
Reads highway_          Express API          Pure Python RLS
drive.csv, injects      POST /api/predict    No numpy/scipy
Gaussian sensor                              Matrix ops from
noise (Box-Muller)      Spawns Python        scratch
                        per sample
        ↓                    ↓                     ↓
  HTTP POST            MySQL INSERT          Returns:
  /api/predict         telemetry table       predicted_soc
                                             updated W, P
                             ↓               r_internal
                       io.emit("telemetry")
                             ↓
                        React Dashboard
                        (WebSocket, live)
```

**Three concurrent processes at runtime:**
1. `server.js` — Express + Socket.io server
2. `ev_streamer.js` — CSV reader, noise injector, HTTP poster (spawned by server)
3. `rls_engine.py` — stateless RLS engine (spawned per sample by server)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Recharts, Tailwind CSS |
| Backend | Node.js, Express, Socket.io |
| ML Engine | Python 3 (pure stdlib — no numpy) |
| Database | MySQL |
| Real-time | WebSockets via Socket.io |
| Noise Model | Gaussian white noise via Box-Muller transform |

---

## The RLS Algorithm

RLS maintains two state variables across samples:

- **W** `(4×1)` — weight vector mapping `[1, V, I, T]` → SoC
- **P** `(4×4)` — covariance matrix representing estimation uncertainty

On every new sample the update equations are:

```
β  = [1, voltage, current, temperature]ᵀ
K  = P·β / (λ + βᵀ·P·β)          ← Kalman gain
e  = true_soc − βᵀ·W              ← prediction error
W  = W + K·e                       ← weight update
P  = (1/λ)·(P − K·βᵀ·P)          ← covariance update
```

Where `λ = 0.98` is the forgetting factor — older samples contribute exponentially less, allowing the estimator to track slow battery dynamics over a drive cycle.

The W and P matrices persist in Node.js server memory between samples, giving RLS its "recursive" property without a database or file I/O.

---

## Internal Resistance Calculation

Alongside SoC estimation, the system computes instantaneous internal resistance using the DC pulse method:

```
Rᵢ = −ΔV / ΔI
```

Only computed when `|ΔI| > 1.0A` between consecutive samples to avoid noise-dominated division. Values outside the physically plausible range for LiFePO₄ (0.001–0.500 Ω) are discarded. A rising Rᵢ trend over a drive cycle is the primary indicator of cell degradation (SoH signal).

---

## Sensor Noise Simulation

`ev_streamer.js` injects realistic ADC noise before posting to the server, simulating what a real embedded BMS sensor would see:

```javascript
// Gaussian white noise via Box-Muller transform
noiseV = gaussian(μ=0, σ=0.03V)    // ADC quantisation noise
noiseI = gaussian(μ=0, σ=0.5A)     // Hall effect sensor noise

// Occasional loose ground wire event (5% probability)
looseWireDrop = random() > 0.95 ? −0.1V : 0
```

This is the same mathematical noise model used in embedded systems signal processing — the RLS estimator must learn through this noise rather than receiving perfect sensor data.

---

## Project Structure

```
bms-project/
├── backend/
│   ├── server.js           Express + Socket.io server
│   ├── rls_engine.py       RLS estimator (pure Python)
│   ├── ev_streamer.js      CSV streamer + noise injector
│   ├── highway_drive.csv   Simulated EV drive cycle dataset
│   ├── Battery_dataset.csv Raw LiFePO₄ characterisation data
│   ├── .env                DB credentials (not committed)
│   └── package.json
└── frontend/
    ├── src/
    │   └── App.jsx         Dashboard (React + Recharts)
    ├── index.html
    └── package.json
```

---

## Setup

### Prerequisites
- Node.js 18+
- Python 3.8+
- MySQL 8+

### Database

```sql
CREATE DATABASE bms_db;
USE bms_db;

CREATE TABLE telemetry (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    battery_id    INT,
    voltage       FLOAT,
    current       FLOAT,
    temperature   FLOAT,
    predicted_soc FLOAT,
    true_soc      FLOAT,
    r_internal    FLOAT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Backend

```bash
cd backend
cp .env.example .env       # add your DB password
npm install
node server.js
```

`.env` format:
```
DB_PASS=your_mysql_password
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Running a Simulation

1. Start the backend (`node server.js`)
2. Start the frontend (`npm run dev`)
3. Open the dashboard
4. Click **INITIATE DRIVE** — the server spawns the streamer, which reads `highway_drive.csv` and posts one sample every 500ms
5. Watch RLS converge from its initial 50% guess toward ground truth in real time
6. Click **STOP ENGINE** at any time to halt the simulation

The dashboard shows:
- **RLS Predicted SoC** — the estimator's current output
- **True SoC** — ground truth from the physics model in the dataset
- **Absolute Error** — live delta, tagged CONV / DVRG / FAIL
- **Internal Resistance Rᵢ** — instantaneous ΔV/ΔI estimate (shows `--` when ΔI is too small for a reliable reading)
- **Twin Convergence bar** — visual representation of how close the estimator is to ground truth

---

## Key Design Decisions

**Why RLS and not a neural network?**
RLS is an online algorithm — it updates on each sample without retraining. For embedded BMS applications with constrained memory and no GPU, this is the correct choice. An LSTM or similar would require batch training offline and deployment of frozen weights; RLS adapts live to the specific battery it's running on.

**Why spawn Python per request instead of a persistent service?**
For this demonstration, stateless spawning keeps the architecture simple and the RLS state management explicit (W and P live in Node.js memory, not Python). A production system would run the Python engine as a persistent microservice with a Unix socket or ZMQ transport to eliminate process spawn overhead.

**Why pure Python matrix ops and not numpy?**
To demonstrate that the algorithm is understood, not just called. The RLS equations are implemented from scratch using nested list comprehensions — every matrix multiply, transpose, and scalar operation is explicit.

---

## What This Demonstrates

- Full-stack system design with a non-trivial data pipeline
- Adaptive estimation theory applied to a real engineering domain (EV battery systems)
- Real-time WebSocket architecture for live telemetry dashboards
- Cross-language integration (Node.js orchestrating Python for compute)
- Signal noise modelling using the Box-Muller transform
- Practical understanding of BMS concepts: SoC, internal resistance, LiFePO₄ chemistry