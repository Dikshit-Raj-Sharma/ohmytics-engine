import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

function App() {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        setChartData(data);
      } catch (error) { 
        console.error("Error fetching data:", error); 
      }
    };

    // Fetch new data from the database every 500ms to match our Node streamer!
    const interval = setInterval(fetchData, 500); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 font-sans">
      <h1 className="text-3xl font-bold text-center mb-2 text-yellow-400">⚡ Live EV Digital Twin</h1>
      <p className="text-center text-gray-400 mb-8">Real-time Recursive Least Squares (RLS) State of Charge Estimation</p>
      
      <div className="max-w-6xl mx-auto bg-gray-900 rounded-2xl p-6 border border-gray-800 shadow-2xl shadow-yellow-500/10 h-[600px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="timestamp" stroke="#9CA3AF" tick={false} />
            {/* The Y-Axis represents percentage, so we lock it between 0 and 100 */}
            <YAxis domain={[0, 100]} stroke="#9CA3AF" unit="%" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }} 
              itemStyle={{ color: '#fff' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }}/>
            
            {/* The True Battery Fuel Gauge (What the math is trying to guess) */}
            <Line 
              type="monotone" 
              dataKey="true_soc" 
              name="True SoC (%)" 
              stroke="#10B981" 
              strokeWidth={3} 
              dot={false} 
              isAnimationActive={false}
            />
            
            {/* Your Python RLS Math Prediction */}
            <Line 
              type="monotone" 
              dataKey="predicted_soc" 
              name="RLS Predicted SoC (%)" 
              stroke="#FBBF24" 
              strokeWidth={3} 
              dot={false} 
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;