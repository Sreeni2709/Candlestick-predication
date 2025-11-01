export interface CandleData {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  analysisType: 'Intraday' | 'Swing' | 'Positional';
}

export interface Prediction {
  nextCandleType: string;
  direction: 'Up' | 'Down';
  projectedMovePoints: number;
  projectedMovePercentage: number;
  targetPrice: number;
  invalidationCondition: string;
  extendedTarget?: {
    targetPrice: number;
    projectedMovePoints: number;
    projectedMovePercentage: number;
    comment: string;
  };
}

export interface AnalysisResult {
  currentCandleAnalysis: string;
  patternIdentification: {
    name: string;
    explanation: string;
  };
  prediction: Prediction;
  volumeAnalysis: string;
}

export interface SavedAnalysis {
  id: string;
  timestamp: string;
  data: CandleData;
  result: AnalysisResult;
}
