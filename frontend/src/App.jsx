import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Custom Tooltip (Refactored to Tailwind)
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const pred = payload.find(p => p.dataKey === 'predicted_soc');
    const true_ = payload.find(p => p.dataKey === 'true_soc');
    const err = pred && true_ ? Math.abs(pred.value - true_.value).toFixed(3) : null;
    return (
      <div className="bg-[#0d1526] border border-amber-400/30 rounded-xl p-3 md:p-4 font-['Space_Mono'] text-[11px] shadow-2xl">
        <p className="text-[#6b7fa8] mb-2 text-[10px]">{label}</p>
        {pred && <p className="text-amber-400 my-1">RLS Pred SoC : {pred.value?.toFixed(2)}%</p>}
        {true_ && <p className="text-cyan-400 my-1">True SoC     : {true_.value?.toFixed(2)}%</p>}
        {err && <p className="text-[#6b7fa8] mt-2 border-t border-white/10 pt-2">Δ Error : {err}%</p>}
      </div>
    );
  }
  return null;
}

function App() {
  const [chartData, setChartData] = useState([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [lastTick, setLastTick] = useState('--');
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/data');
        const data = await response.json();
        setChartData(data);
        setSampleCount(data.length);
        setLastTick(new Date().toISOString().slice(11, 19));
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    const interval = setInterval(fetchData, 500);
    return () => clearInterval(interval);
  }, []);

  // Bring back our Start Engine function!
  const handleStartSimulation = async () => {
    setIsSimulating(true);
    try {
      await fetch('http://localhost:5000/api/start-simulation', { method: 'POST' });
    } catch (error) {
      console.error("Failed to start simulation", error);
      setIsSimulating(false);
    }
  };
  const handleStopSimulation = async () => {
    try {
      await fetch('http://localhost:5000/api/stop-simulation', { method: 'POST' });
      setIsSimulating(false);
    } catch (error) {
      console.error("Failed to stop", error);
    }
  };
  const latest = chartData[chartData.length - 1];
  const predSoc = latest?.predicted_soc ?? null;
  const trueSoc = latest?.true_soc ?? null;
  const absError = predSoc != null && trueSoc != null ? Math.abs(predSoc - trueSoc) : null;
  const convergence = absError != null ? Math.max(0, Math.min(100, 100 - absError * 30)) : 0;

  const allTrue = chartData.map(d => d.true_soc).filter(Boolean);
  const allPred = chartData.map(d => d.predicted_soc).filter(Boolean);
  const allVals = [...allTrue, ...allPred];
  const yMin = allVals.length ? Math.floor(Math.min(...allVals)) - 2 : 0;
  const yMax = allVals.length ? Math.ceil(Math.max(...allVals)) + 2 : 100;

  const errorTag = absError == null ? null : absError < 0.5 ? { label: 'CONV', text: 'text-green-400', bg: 'bg-green-400/10' }
    : absError < 1.5 ? { label: 'DVRG', text: 'text-amber-400', bg: 'bg-amber-400/10' }
    : { label: 'FAIL', text: 'text-red-400', bg: 'bg-red-400/10' };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap');
      `}</style>

      <div className="min-h-screen bg-[#080e1a] text-[#f0f4ff] font-['DM_Sans'] p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 md:w-11 md:h-11 bg-amber-400/10 border border-amber-400/30 rounded-xl flex items-center justify-center text-xl shadow-lg shadow-amber-400/5">
              ⚡
            </div>
            <div>
              <h1 className="font-['Space_Mono'] text-lg md:text-xl font-bold text-amber-400 tracking-tight m-0 leading-tight">
                OHMYTICS ENGINE
              </h1>
              <p className="text-[10px] md:text-[11px] text-[#6b7fa8] tracking-wider mt-1 uppercase">
                LiFePO₄ · RLS State Estimator · Digital Twin v1.0
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* The Start Button */}
            {isSimulating ? (
              <button 
                onClick={handleStopSimulation}
                className="flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-['Space_Mono'] rounded-lg border transition-all bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 cursor-pointer shadow-[0_0_15px_rgba(248,113,113,0.15)]"
              >
                ⏹ STOP ENGINE
              </button>
            ) : (
              <button   
                onClick={handleStartSimulation}
                className="flex-1 md:flex-none px-4 py-2 text-xs md:text-sm font-['Space_Mono'] rounded-lg border transition-all bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30 cursor-pointer shadow-[0_0_15px_rgba(34,211,238,0.15)]"
              >
                ▶ INITIATE DRIVE
              </button>
            )}

            <div className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full bg-green-400/10 border border-green-400/20 font-['Space_Mono'] text-[10px] md:text-[11px] text-green-400 tracking-wider">
              <span className={`w-1.5 h-1.5 rounded-full bg-green-400 ${isSimulating ? 'animate-pulse' : ''}`}></span>
              <span className="hidden sm:inline">STREAM ACTIVE</span>
              <span className="sm:hidden">LIVE</span>
            </div>
          </div>
        </div>

        {/* Metric Cards - Tailwind Grid makes this mobile responsive! */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'RLS Predicted SoC', value: predSoc?.toFixed(2) ?? '--', unit: '%', sub: 'recursive estimate', tag: { label: '+RLS', text: 'text-green-400', bg: 'bg-green-400/10' }, accent: 'border-t-amber-400/40' },
            { label: 'True SoC (Ground Truth)', value: trueSoc?.toFixed(2) ?? '--', unit: '%', sub: 'physics model', tag: { label: 'BMS', text: 'text-cyan-400', bg: 'bg-cyan-400/10' }, accent: 'border-t-cyan-400/40' },
            { label: 'Absolute Error', value: absError?.toFixed(3) ?? '--', unit: '%', sub: 'live delta', tag: errorTag, accent: 'border-t-green-400/40' },
            { label: 'Internal Resistance Rᵢ', value: '0.050', unit: 'Ω', sub: 'nominal baseline', tag: { label: 'SoH', text: 'text-amber-400', bg: 'bg-amber-400/10' }, accent: 'border-t-[#6b7fa8]/40' },
          ].map((m, i) => (
            <div key={i} className={`bg-[#111d30] border border-white/5 rounded-xl p-4 md:p-5 border-t-2 ${m.accent} shadow-lg`}>
              <div className="font-['Space_Mono'] text-[9px] md:text-[10px] uppercase tracking-widest text-[#6b7fa8] mb-2">
                {m.label}
              </div>
              <div className="font-['Space_Mono'] text-2xl md:text-3xl font-bold text-[#f0f4ff] leading-none mb-2">
                {m.value}<span className="text-xs md:text-sm text-[#6b7fa8] font-normal ml-1">{m.unit}</span>
              </div>
              <div className="text-[10px] md:text-[11px] text-[#6b7fa8] flex items-center gap-2">
                {m.tag && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-['Space_Mono'] ${m.tag.bg} ${m.tag.text}`}>
                    {m.tag.label}
                  </span>
                )}
                {m.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Chart Panel */}
        <div className="bg-[#0d1526] border border-white/5 rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-5 gap-3">
            <div className="font-['Space_Mono'] text-[9px] md:text-[11px] uppercase tracking-[0.1em] md:tracking-[0.15em] text-[#6b7fa8]">
              SoC Convergence Timeline · Highway Drive
            </div>
            <div className="flex gap-4">
              {[
                { color: '#fbbf24', label: 'RLS Predicted', dashed: false },
                { color: '#22d3ee', label: 'True SoC', dashed: true },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] md:text-[11px] text-[#6b7fa8] font-['Space_Mono']">
                  <svg width="20" height="10" className="md:w-6">
                    <line x1="0" y1="5" x2="100%" y2="5" stroke={l.color} strokeWidth="2" strokeDasharray={l.dashed ? '4,3' : 'none'} />
                    <circle cx="50%" cy="5" r="2.5" fill={l.color} />
                  </svg>
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          <div className="h-[250px] md:h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="timestamp" stroke="transparent" tick={false} />
                <YAxis
                  domain={[yMin, yMax]}
                  stroke="transparent"
                  tick={{ fill: '#4a5c7a', fontSize: 10, fontFamily: "'Space Mono', monospace" }}
                  tickFormatter={v => `${v}%`}
                  width={35}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="true_soc" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="predicted_soc" stroke="#fbbf24" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Convergence Bar */}
          <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center gap-3 md:gap-4">
            <div className="font-['Space_Mono'] text-[9px] md:text-[10px] uppercase tracking-widest text-[#6b7fa8]">
              Twin Convergence
            </div>
            <div className="flex-1 h-1 md:h-1.5 bg-white/5 rounded-full overflow-hidden min-w-[100px]">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-green-400 transition-all duration-700 ease-out"
                style={{ width: `${convergence.toFixed(1)}%` }} 
              />
            </div>
            <div className="font-['Space_Mono'] text-[10px] md:text-[11px] text-green-400 min-w-[40px] text-right">
              {convergence.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3 text-center sm:text-left">
          <div className="font-['Space_Mono'] text-[9px] md:text-[10px] text-[#3d4f6e] tracking-wider">
            OHMYTICS ENGINE © 2026 · TRIPLE-THREAD ARCHITECTURE
          </div>
          <div className="font-['Space_Mono'] text-[9px] md:text-[10px] text-[#6b7fa8] flex gap-4">
            <span>LAST TICK: <span className="text-amber-400">{lastTick}</span></span>
            <span>SAMPLES: <span className="text-amber-400">{sampleCount.toLocaleString()}</span></span>
          </div>
        </div>

      </div>
    </>
  );
}

export default App;
