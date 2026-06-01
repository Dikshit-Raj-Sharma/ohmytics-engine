const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();
const { spawn } = require("child_process");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "*" }
});
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

app.use(express.json());

let simulationRunning = false;
let activeSimProcess = null;
let globalW = [[50.0], [0.0], [0.0], [0.0]]; // Initial bad guess (50%)
let globalP = [
  [1000, 0, 0, 0],
  [0, 1000, 0, 0],
  [0, 0, 1000, 0],
  [0, 0, 0, 1000],
]; // High uncertainty
let globalPrevVoltage = null;
let globalPrevCurrent = null;

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) console.log("Database Connection Error: ", err);
  else console.log("MySQL Connected!");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
// A simple test route
app.get("/", (req, res) => {
  res.send("BMS Backend is Running");
});

app.get("/api/data", (req, res) => {
  db.query(
    "SELECT * FROM telemetry ORDER BY id DESC LIMIT 50",
    (err, results) => {
      if (err) return res.status(500).json({ error: "DB Error" });
      res.json(results.reverse());
    },
  );
});

app.post("/api/start-simulation", (req, res) => {
  if (simulationRunning) {
    return res.status(400).json({ error: "Simulation is already active!" });
  }

  simulationRunning = true;
  globalW = [[50.0], [0.0], [0.0], [0.0]];
  globalP = [
    [1000, 0, 0, 0],
    [0, 1000, 0, 0],
    [0, 0, 1000, 0],
    [0, 0, 0, 1000],
  ];
  globalPrevVoltage = null;
  globalPrevCurrent = null;

  db.query("TRUNCATE TABLE telemetry", () => {
    console.log("⚡ UI Triggered: Starting Engine...");
    // io.emit("simulation_reset");
    // 3. Spawn the worker and save it to the global variable
    activeSimProcess = spawn("node", ["ev_streamer.js"]);

    activeSimProcess.stdout.on("data", (data) => {
      console.log(`[Simulator]: ${data.toString().trim()}`);
    });

    activeSimProcess.on("close", () => {
      simulationRunning = false;
      activeSimProcess = null;
      console.log("🏁 Drive Complete.");
    });

    res.json({ message: "Engine started successfully" });
  });
});

app.post("/api/stop-simulation", (req, res) => {
  if (activeSimProcess) {
    activeSimProcess.kill();
    activeSimProcess = null;
  }
  simulationRunning = false;
  res.json({ message: "Simulation stopped." });
});

app.post("/api/predict", (req, res) => {
  const { battery_id, voltage, current, temperature, true_soc } = req.body;
  const inputData = JSON.stringify({
    voltage,
    current,
    temperature,
    true_soc,
    W: globalW,
    P: globalP,
    prev_voltage: globalPrevVoltage,
    prev_current: globalPrevCurrent,
  });
  const pythonProcess = spawn("python3", ["rls_engine.py", inputData]);

  let pythonOutput = "";
  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });

  pythonProcess.on("close", (code) => {
    try {
      const prediction = JSON.parse(pythonOutput);
      const socValue = prediction.predicted_soc;
      // 3. UPDATE THE MEMORY! Catch the new, smarter matrices from Python
      if (prediction.new_W && prediction.new_P) {
        globalW = prediction.new_W;
        globalP = prediction.new_P;
        globalPrevVoltage = voltage;
        globalPrevCurrent = current;
      }
      const sql = "INSERT INTO telemetry (battery_id, voltage, current, temperature, predicted_soc, true_soc, r_internal) VALUES (?, ?, ?, ?, ?, ?, ?)";
      db.query(
        sql,
        [battery_id, voltage, current, temperature, socValue, true_soc,prediction.r_internal ?? null],
        (err, result) => {
          if (err) {
            console.error("THE REAL MYSQL ERROR IS: ", err);
            return res.status(500).json({ error: "DB Error" });
          }
          io.emit("telemetry", {
            id: result.insertId,
            voltage,
            current,
            temperature,
            predicted_soc: prediction.predicted_soc,
            true_soc,
            r_internal: prediction.r_internal,
          });
          res.json({
            message: "Success! Data logged and Math calculated.",
            database_id: result.insertId,
            final_prediction: socValue,
          });
        },
      );
    } catch (error) {
      res.status(500).json({
        error: "Failed to parse Python output",
        raw_output: pythonOutput,
      });
    }
  });
});

