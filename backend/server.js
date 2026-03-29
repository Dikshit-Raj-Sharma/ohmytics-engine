const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/predict", (req, res) => {
  const userVoltage = req.body.voltage;
  const inputData = JSON.stringify({ voltage: userVoltage });

  const pythonProcess = spawn("python3", ["rls_engine.py", inputData]);

  let pythonOutput = "";
  pythonProcess.stdout.on("data", (data) => {
    pythonOutput += data.toString();
  });
  pythonProcess.on("close", (code) => {
    try {
      const result = JSON.parse(pythonOutput);
      res.json({ message: "Python math complete!", data: result });
    } catch (error) {
      res
        .status(500)
        .json({
          error: "Failed to parse Python output",
          raw_output: pythonOutput,
        });
    }
  });
});
// Create the connection to MySQL
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
