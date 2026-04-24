const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

let simulationRunning = false;
let activeSimProcess = null;
let globalW = [[50.0], [0.0], [0.0], [0.0]]; // Initial bad guess (50%)
let globalP = [[1000, 0, 0, 0], [0, 1000, 0, 0], [0, 0, 1000, 0], [0, 0, 0, 1000]]; // High uncertainty

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "tearsofjoy",
  database: "bms_db",
});

db.connect((err) => {
  if (err) console.log("Database Connection Error: ", err);
  else console.log("MySQL Connected!");
});

// A simple test route
app.get("/", (req, res) => {
  res.send("BMS Backend is Running");
});

app.listen(5000, () => {
  console.log("Server started on port 5000");
});

app.get("/api/data", (req, res) => {
  const sql = "SELECT * FROM telemetry ORDER BY id DESC LIMIT 50";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ error: "DB Error" });
    }
    res.json(results.reverse());
  });
});

app.post("/api/start-simulation", (req, res) => {
  if (simulationRunning) {
    return res.status(400).json({ error: "Simulation is already active!" });
  }

  simulationRunning = true;
  // 1. Wipe the Memory so a restart actually "learns" again
  globalW = [[50.0], [0.0], [0.0], [0.0]];
  globalP = [[1000, 0, 0, 0], [0, 1000, 0, 0], [0, 0, 1000, 0], [0, 0, 0, 1000]];

  db.query("TRUNCATE TABLE telemetry", () => {
    console.log("⚡ UI Triggered: Starting Engine...");
    
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
  res.json({ message: "Simulation forcibly stopped." });
  // db.query("TRUNCATE TABLE telemetry", () => {
  //   res.json({ message: "Simulation stopped and chart cleared." });
  // });
});
app.post("/api/predict", (req, res) => {
  const { battery_id, voltage, current, temperature, true_soc } = req.body;
  const inputData = JSON.stringify({ 
      voltage, 
      current, 
      temperature, 
      true_soc,
      W: globalW,  // Send current memory
      P: globalP   // Send current uncertainty
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
      }
      const sql =
        "INSERT INTO telemetry (battery_id, voltage, current, temperature, predicted_soc, true_soc) VALUES (?, ?, ?, ?, ?, ?)";
      db.query(
        sql,
        [battery_id, voltage, current, temperature, socValue, true_soc],
        (err, result) => {
          if (err) {
            console.error("THE REAL MYSQL ERROR IS: ", err);
            return res.status(500).json({ error: "DB Error" });
          }
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
