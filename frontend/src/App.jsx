import { useState } from "react";

function App() {
  const [voltage, setVoltage] = useState(12.5);
  const [current, setCurrent] = useState(1);
  const [temperature, setTemperature] = useState(25);

  const [prediction, setPrediction] = useState(null);

  const [loading, setLoading] = useState(false);

  const sendDataToBackend = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battery_id: 1,
          voltage: parseFloat(voltage),
          current: parseFloat(current),
          temperature: parseFloat(temperature),
        }),
      });
      if (!response.ok) {
        throw new Error("Backend error");
      }
      const data = await response.json();
      setPrediction(data.final_prediction);
    } catch (error) {
      console.error("Failed to send data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-yellow-400 flex flex-col items-center justify-center p-4">
      
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-lg p-6 border border-yellow-500">
        <h1 className="text-2xl font-bold text-center mb-6"> ⚡BMS Telemetry Simulator</h1>
        <div className="mb-4">
        <label className="block mb-1">Voltage: {voltage}</label>
        <input
          type="range"
          min="9"
          max="14"
          step="0.1"
          value={voltage}
          onChange={(e) => setVoltage(e.target.value)}
        />
        </div>

        <div className="mb-4">
        <label className="block mb-1">Current: {current}</label>
        <input
          type="range"
          min="-50"
          max="50"
          step="1"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        </div>
        <div className="mb-4">
        <label className="block mb-1">Temperature: {temperature}</label>
        <input
          type="range"
          min="10"
          max="60"
          step="1"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
        />
        </div>
        <button onClick={sendDataToBackend}
        className="w-full bg-yellow-400 text-black font-semibold py-2 rounded-xl hover:bg-yellow-300 transition duration-300 shadow-md hover:shadow-yellow-500"
        >⚡Predict SOC</button>
        {prediction !== null && (
          <div className="mt-6 text-center">
            <h2 className="text-xl font-bold">
              🔋 Predicted SoC: {prediction} %
            </h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
