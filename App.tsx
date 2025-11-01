import React, { useState, useMemo, useEffect } from 'react';
import type { CandleData, AnalysisResult, SavedAnalysis } from './types';
import { analyzeCandleData } from './services/geminiService';
import Candlestick from './components/Candlestick';
import ArrowUpIcon from './components/icons/ArrowUpIcon';
import ArrowDownIcon from './components/icons/ArrowDownIcon';
import InfoIcon from './components/icons/InfoIcon';
import TrashIcon from './components/icons/TrashIcon';

const calculatePredictedCandle = (
  result: AnalysisResult,
  currentCandle: { open: number; high: number; low: number; close: number }
): { open: number; high: number; low: number; close: number } => {
  const { targetPrice, nextCandleType, projectedMovePoints } = result.prediction;
  const currentClose = currentCandle.close;

  const open = currentClose;
  const close = targetPrice;
  let high = Math.max(open, close);
  let low = Math.min(open, close);

  const bodySize = Math.abs(open - close);
  const moveSize = Math.abs(projectedMovePoints);
  const typeLower = nextCandleType.toLowerCase();

  if (typeLower.includes('marubozu')) {
    return { open, high, low, close };
  }
  
  const baseWickSize = moveSize * 0.15 > 0 ? moveSize * 0.15 : bodySize * 0.15 || 1;
  high += baseWickSize;
  low -= baseWickSize;

  if (typeLower.includes('hammer') || typeLower.includes('hanging man')) {
    low = Math.min(low, Math.min(open, close) - (bodySize * 2.5 + baseWickSize));
    high = Math.max(open, close) + (bodySize * 0.1 + baseWickSize);
  } else if (typeLower.includes('inverted hammer') || typeLower.includes('shooting star')) {
    high = Math.max(high, Math.max(open, close) + (bodySize * 2.5 + baseWickSize));
    low = Math.min(open, close) - (bodySize * 0.1 + baseWickSize);
  } else if (typeLower.includes('doji') || typeLower.includes('spinning top')) {
    const wickSize = bodySize > 0.1 ? bodySize * 2 : moveSize;
    high = Math.max(open, close) + wickSize;
    low = Math.min(open, close) - wickSize;
  }
  
  high = Math.max(high, open, close);
  low = Math.min(low, open, close);

  return { open, high, low, close };
};

// Simple UUID generator
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const App: React.FC = () => {
  const [candleData, setCandleData] = useState<CandleData>({
    open: '', high: '', low: '', close: '', volume: '', analysisType: 'Intraday',
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [predictedCandleData, setPredictedCandleData] = useState<{ open: number; high: number; low: number; close: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);

  useEffect(() => {
    try {
      const storedAnalyses = localStorage.getItem('candlestickAnalyses');
      if (storedAnalyses) {
        setSavedAnalyses(JSON.parse(storedAnalyses));
      }
    } catch (e) {
      console.error("Failed to load analyses from local storage", e);
      setSavedAnalyses([]);
    }
  }, []);

  const numericCandleData = useMemo(() => ({
    open: parseFloat(candleData.open),
    high: parseFloat(candleData.high),
    low: parseFloat(candleData.low),
    close: parseFloat(candleData.close),
  }), [candleData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCandleData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAnalysisTypeChange = (type: 'Intraday' | 'Swing' | 'Positional') => {
    setCandleData((prev) => ({ ...prev, analysisType: type }));
  };
  
  const isFormValid = useMemo(() => {
    const { open, high, low, close } = numericCandleData;
    return !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) && high >= low && open <= high && open >= low && close <= high && close >= low;
  }, [numericCandleData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setError("Please enter valid O, H, L, C values. High must be >= Low, and Open/Close must be between High and Low.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setAnalysisResult(null);
    setPredictedCandleData(null);

    try {
      const result = await analyzeCandleData(candleData);
      setAnalysisResult(result);
      const pcd = calculatePredictedCandle(result, numericCandleData);
      setPredictedCandleData(pcd);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAnalysis = () => {
    if (!analysisResult) return;
    const newSavedAnalysis: SavedAnalysis = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      data: candleData,
      result: analysisResult,
    };
    const updatedAnalyses = [newSavedAnalysis, ...savedAnalyses];
    setSavedAnalyses(updatedAnalyses);
    localStorage.setItem('candlestickAnalyses', JSON.stringify(updatedAnalyses));
  };

  const handleLoadAnalysis = (saved: SavedAnalysis) => {
    setCandleData(saved.data);
    setAnalysisResult(saved.result);
    const numericData = { open: parseFloat(saved.data.open), high: parseFloat(saved.data.high), low: parseFloat(saved.data.low), close: parseFloat(saved.data.close) };
    const pcd = calculatePredictedCandle(saved.result, numericData);
    setPredictedCandleData(pcd);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteAnalysis = (id: string) => {
    const updatedAnalyses = savedAnalyses.filter(sa => sa.id !== id);
    setSavedAnalyses(updatedAnalyses);
    localStorage.setItem('candlestickAnalyses', JSON.stringify(updatedAnalyses));
  };

  const InputField: React.FC<{ name: keyof CandleData; label: string; placeholder: string; isOptional?: boolean }> = ({ name, label, placeholder, isOptional = false }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-400">
        {label} {isOptional && <span className="text-xs">(Optional)</span>}
      </label>
      <input
        type="number" name={name} id={name} value={candleData[name]} onChange={handleInputChange}
        className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        placeholder={placeholder} step="any"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
            AI Candlestick Analyzer
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Get detailed, trader-grade analysis for Intraday, Swing, or Positional timeframes.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg h-fit">
              <h2 className="text-2xl font-bold mb-6 text-white">Enter Candle Data</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-400">Analysis Type</label>
                    <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-gray-700 p-1">
                        {(['Intraday', 'Swing', 'Positional'] as const).map((type) => (
                            <button key={type} type="button" onClick={() => handleAnalysisTypeChange(type)}
                                className={`rounded-md py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 ${candleData.analysisType === type ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-300 hover:bg-gray-600/50'}`}>
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
                <InputField name="open" label="Open" placeholder="e.g., 100" />
                <InputField name="high" label="High" placeholder="e.g., 105" />
                <InputField name="low" label="Low" placeholder="e.g., 98" />
                <InputField name="close" label="Close" placeholder="e.g., 102" />
                <InputField name="volume" label="Volume" placeholder="e.g., 100000" isOptional />
                <button type="submit" disabled={isLoading || !isFormValid}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400/50 disabled:cursor-not-allowed transition-colors">
                  {isLoading ? <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : `Analyze ${candleData.analysisType} Pattern`}
                </button>
              </form>
            </div>
            {savedAnalyses.length > 0 && (
                <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg h-fit">
                    <h3 className="text-xl font-bold text-white mb-4">Saved Analyses</h3>
                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 -mr-2">
                        {savedAnalyses.map(sa => (
                            <div key={sa.id} className="bg-gray-700/50 p-3 rounded-lg flex items-center justify-between">
                                <div className="text-sm">
                                    <p className="font-semibold text-gray-300">{new Date(sa.timestamp).toLocaleDateString()} - {sa.data.analysisType}</p>
                                    <p className="text-xs text-gray-400">O:{sa.data.open} H:{sa.data.high} L:{sa.data.low} C:{sa.data.close}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => handleLoadAnalysis(sa)} className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold">LOAD</button>
                                    <button onClick={() => handleDeleteAnalysis(sa.id)} className="text-gray-500 hover:text-red-400 p-1"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-8">
             {error && <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg" role="alert">{error}</div>}
            
             {analysisResult && predictedCandleData && (
              <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg">
                <div className="flex justify-between items-start">
                    <h3 className="text-xl font-bold text-white mb-6 text-center">Visual Analysis ({candleData.analysisType})</h3>
                    <button onClick={handleSaveAnalysis} className="bg-indigo-600/80 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors">SAVE ANALYSIS</button>
                </div>
                <div className="flex items-start justify-around gap-4">
                  <div className="flex flex-col items-center"><Candlestick {...numericCandleData} /><p className="text-center mt-4 text-base font-semibold text-gray-300">Current</p><p className="text-center text-sm font-medium text-gray-400 break-words w-32" title={analysisResult.patternIdentification.name}>{analysisResult.patternIdentification.name}</p></div>
                  <div className="text-gray-500 text-5xl font-thin pt-20">→</div>
                  <div className="flex flex-col items-center"><Candlestick {...predictedCandleData} /><p className="text-center mt-4 text-base font-semibold text-indigo-300">Prediction</p><p className="text-center text-sm font-medium text-gray-400 break-words w-32" title={analysisResult.prediction.nextCandleType}>{analysisResult.prediction.nextCandleType}</p><div className="mt-2 text-xs text-center space-y-1 w-32"><div className={`flex items-center justify-center font-semibold ${analysisResult.prediction.direction === 'Up' ? 'text-green-400' : 'text-red-400'}`}>{analysisResult.prediction.direction === 'Up' ? <ArrowUpIcon className="w-3 h-3 mr-1" /> : <ArrowDownIcon className="w-3 h-3 mr-1" />}<span>{analysisResult.prediction.projectedMovePoints.toFixed(2)} pts ({analysisResult.prediction.projectedMovePercentage.toFixed(2)}%)</span></div><div className="text-gray-400">Target: <span className="font-bold text-gray-300">{analysisResult.prediction.targetPrice.toLocaleString()}</span></div></div></div>
                </div>
              </div>
            )}

            {!analysisResult && !isLoading && (
              <><div className="bg-gray-800/50 p-8 rounded-2xl text-center flex flex-col items-center justify-center min-h-[400px]"><div className="flex items-center justify-center space-x-6"><Candlestick {...numericCandleData} /><div className="text-gray-500 text-4xl font-bold">→</div><div className="w-24 h-48 bg-gray-800 rounded-lg flex items-center justify-center text-6xl text-gray-600 shadow-inner">?</div></div><h3 className="text-xl font-semibold mt-6 text-gray-300">Your Analysis Will Appear Here</h3><p className="text-gray-500 mt-2">Enter your candlestick data to get started.</p></div><div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg flex items-start space-x-4"><InfoIcon className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" /><div><h3 className="text-xl font-bold text-white mb-2">Analysis Information</h3><p className="text-gray-400">This tool provides a detailed breakdown of candlestick patterns:</p><ul className="list-disc list-inside text-gray-400 mt-2 space-y-1"><li><span className="font-semibold text-gray-300">Candle Analysis:</span> A factual description of the candle's features (body, wicks).</li><li><span className="font-semibold text-gray-300">Pattern Identification:</span> The specific name and meaning of the candlestick pattern.</li><li><span className="font-semibold text-gray-300">Predicted Movement:</span> A data-driven forecast for the next candle.</li></ul></div></div></>
            )}

            {isLoading && !analysisResult && (
              <div className="bg-gray-800/50 p-8 rounded-2xl flex items-center justify-center min-h-[400px]"><div className="text-center"><svg className="animate-spin mx-auto h-12 w-12 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><h3 className="mt-4 text-lg font-semibold text-gray-300">Analyzing...</h3><p className="text-gray-500">The AI is processing your data.</p></div></div>
            )}
            
            {analysisResult && (
              <div className="space-y-6">
                <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg"><h3 className="text-xl font-bold text-white mb-4">Candle Analysis</h3><p className="text-gray-300 whitespace-pre-wrap">{analysisResult.currentCandleAnalysis}</p></div>
                <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg"><h3 className="text-xl font-bold text-white mb-4">Pattern Identification</h3><p className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-400 mb-2">{analysisResult.patternIdentification.name}</p><p className="text-gray-300 whitespace-pre-wrap">{analysisResult.patternIdentification.explanation}</p></div>
                <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg"><h3 className="text-xl font-bold text-white mb-4">Next Candle Prediction ({candleData.analysisType})</h3><p className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-400 mb-4">{analysisResult.prediction.nextCandleType}</p><div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm"><div className="flex items-center space-x-2">{analysisResult.prediction.direction === 'Up' ? <ArrowUpIcon className="w-5 h-5 text-green-400" /> : <ArrowDownIcon className="w-5 h-5 text-red-400" />}<span className={`font-bold ${analysisResult.prediction.direction === 'Up' ? 'text-green-400' : 'text-red-400'}`}>{analysisResult.prediction.direction}</span></div><div className="text-right"><span className="text-gray-400">Target: </span><span className="font-semibold text-white">{analysisResult.prediction.targetPrice.toLocaleString()}</span></div><div><span className="text-gray-400">Move (Pts): </span><span className="font-semibold text-white">{analysisResult.prediction.projectedMovePoints.toFixed(2)}</span></div><div className="text-right"><span className="text-gray-400">Move (%): </span><span className="font-semibold text-white">{analysisResult.prediction.projectedMovePercentage.toFixed(2)}%</span></div></div><div className="mt-4 pt-4 border-t border-gray-700/50"><h4 className="text-sm font-semibold text-yellow-400/80">Invalidation Condition</h4><p className="text-gray-300 mt-1 text-sm">{analysisResult.prediction.invalidationCondition}</p></div>{analysisResult.prediction.extendedTarget && (<div className="mt-4 pt-4 border-t border-gray-700/50"><h4 className="text-sm font-semibold text-purple-400/80">Extended Target <span className="text-xs font-medium text-gray-400">({analysisResult.prediction.extendedTarget.comment})</span></h4><div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mt-2"><div><span className="text-gray-400">Target: </span><span className="font-semibold text-white">{analysisResult.prediction.extendedTarget.targetPrice.toLocaleString()}</span></div><div className="text-right"><span className="text-gray-400">Move: </span><span className="font-semibold text-white">{analysisResult.prediction.extendedTarget.projectedMovePoints.toFixed(2)} pts ({analysisResult.prediction.extendedTarget.projectedMovePercentage.toFixed(2)}%)</span></div></div></div>)}</div>
                <div className="bg-gray-800/50 p-6 rounded-2xl shadow-lg flex items-start space-x-4"><InfoIcon className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" /><div><h3 className="text-xl font-bold text-white mb-2">Volume Commentary</h3><p className="text-gray-300 whitespace-pre-wrap">{analysisResult.volumeAnalysis}</p></div></div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
