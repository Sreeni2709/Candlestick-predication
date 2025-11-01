
import React from 'react';

interface CandlestickProps {
  open: number;
  high: number;
  low: number;
  close: number;
}

const Candlestick: React.FC<CandlestickProps> = ({ open, high, low, close }) => {
  if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || high < low || open > high || open < low || close > high || close < low) {
    return (
      <div className="flex items-center justify-center w-24 h-48 bg-gray-800 rounded-lg">
        <span className="text-xs text-gray-500">Invalid Data</span>
      </div>
    );
  }

  const isBullish = close > open;
  const color = isBullish ? 'bg-green-500' : 'bg-red-500';
  const wickColor = isBullish ? 'bg-green-500' : 'bg-red-500';

  const range = high - low;
  if (range === 0) return null;

  const bodyHeight = (Math.abs(open - close) / range) * 100;
  const topWickHeight = ((high - Math.max(open, close)) / range) * 100;
  const bottomWickHeight = ((Math.min(open, close) - low) / range) * 100;

  const bodyTop = ((high - Math.max(open, close)) / range) * 100;

  return (
    <div className="relative w-24 h-48" aria-label={`Candlestick from ${low} to ${high}`}>
      {/* Top Wick */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-1 ${wickColor}`}
        style={{ top: '0%', height: `${topWickHeight}%` }}
      ></div>
      {/* Body */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-8 ${color} rounded`}
        style={{ top: `${bodyTop}%`, height: `${bodyHeight}%` }}
      ></div>
      {/* Bottom Wick */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-1 ${wickColor}`}
        style={{ bottom: '0%', height: `${bottomWickHeight}%` }}
      ></div>
    </div>
  );
};

export default Candlestick;
