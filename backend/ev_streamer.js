const fs = require("fs");
const csv = require("csv-parser");

const URL = process.env.BACKEND_URL || "http://localhost:5000";

// DSP Feature: Box-Muller transform for true Gaussian White Noise
function getGaussianNoise(mean = 0, standardDeviation = 0.5) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * standardDeviation + mean;
}

async function streamData() {
  const rows = [];

  fs.createReadStream("highway_drive.csv")
    .pipe(csv())
    .on("data", (data) => rows.push(data))
    .on("end", async () => {
      for (const row of rows) {
        // 1. Extract the perfect, clean physics data
        const cleanVoltage = parseFloat(row.voltage);
        const cleanCurrent = parseFloat(row.current);

        // 2. Inject Gaussian EMI Noise (Simulating a bad inverter sensor)
        // Adding +/- 1.5V noise to voltage and +/- 2.0A noise to current
        // Simulating motor inverter throwing 30-Amp spikes and 2.5V swings
        const noiseI = getGaussianNoise(0, 0.5); // Realistic ADC noise
        const noiseV = getGaussianNoise(0, 0.03);
        const looseWireDrop = Math.random() > 0.95 ? -0.1 : 0;

        const noisyVoltage = cleanVoltage + noiseV + looseWireDrop;
        const noisyCurrent = cleanCurrent + noiseI;

        const payload = {
          battery_id: 1,
          voltage: noisyVoltage,
          current: noisyCurrent,
          temperature: parseFloat(row.temperature),
          true_soc: parseFloat(row.true_soc),
        };

        try {
          const response = await fetch(`${URL}/api/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const resData = await response.json();
        } catch (error) {
          console.error("Server Error", error.message);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    });
}
streamData();
