import { GoogleGenAI, Type } from "@google/genai";
import type { CandleData, AnalysisResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const extendedTargetSchema = {
    type: Type.OBJECT,
    properties: {
        targetPrice: { type: Type.NUMBER, description: "The extended target price, e.g., for a 1:2 risk/reward scenario." },
        projectedMovePoints: { type: Type.NUMBER, description: "The extended projected move in points." },
        projectedMovePercentage: { type: Type.NUMBER, description: "The extended projected move in percentage." },
        comment: { type: Type.STRING, description: "A brief comment about this extended target, e.g., 'For a 1:2 Reward:Risk ratio'." }
    },
    required: ["targetPrice", "projectedMovePoints", "projectedMovePercentage", "comment"]
};

const predictionSchema = {
  type: Type.OBJECT,
  properties: {
    nextCandleType: { type: Type.STRING, description: "The most likely next candle type." },
    direction: { type: Type.STRING, enum: ["Up", "Down"], description: "The predicted direction of the market." },
    projectedMovePoints: { type: Type.NUMBER, description: "The projected move in points for a 1:1 risk/reward." },
    projectedMovePercentage: { type: Type.NUMBER, description: "The projected move in percentage." },
    targetPrice: { type: Type.NUMBER, description: "The predicted target price for the next candle." },
    invalidationCondition: { type: Type.STRING, description: "A clear condition that would invalidate this prediction. E.g., 'Invalidated if the next candle closes above [price]'." },
    extendedTarget: { ...extendedTargetSchema, description: "An optional extended target for a higher risk/reward scenario. Only include if logical." }
  },
  required: ["nextCandleType", "direction", "projectedMovePoints", "projectedMovePercentage", "targetPrice", "invalidationCondition"],
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    currentCandleAnalysis: {
      type: Type.STRING,
      description: "Detailed, narrative analysis of the current candle's physical characteristics. Include specific point values for the body and shadows, the full range, and the percentage change of the range relative to the open price. Add context relevant to the trading timeframe (e.g., 'low volatility for an intraday move')."
    },
    patternIdentification: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "The specific name of the candlestick pattern identified (e.g., 'Momentum Bearish', 'Doji')." },
        explanation: { type: Type.STRING, description: "Detailed explanation of the pattern. Justify the classification, explain why it's not other similar patterns (e.g., 'not a doji because body >1% of range'), and discuss what it implies for trend continuation or reversal." },
      },
      required: ["name", "explanation"],
    },
    prediction: predictionSchema,
    volumeAnalysis: {
      type: Type.STRING,
      description: "Detailed analysis of how volume (or lack thereof) confirms or weakens the identified pattern and the prediction. Be specific about whether the volume signature is typical for this pattern.",
    },
  },
  required: ["currentCandleAnalysis", "patternIdentification", "prediction", "volumeAnalysis"],
};


export const analyzeCandleData = async (data: CandleData): Promise<AnalysisResult> => {
    const prompt = `
    Analyze the following financial candlestick data for an asset from a ${data.analysisType} trading perspective. Provide a highly detailed, professional-grade analysis suitable for a trader's notes.

    Asset Data:
    Open: ${data.open}
    High: ${data.high}
    Low: ${data.low}
    Close: ${data.close}
    Volume: ${data.volume || 'Not provided'}
    Analysis Timeframe: ${data.analysisType}

    Follow this exact structure for your analysis, providing rich, narrative detail in each section:

    1.  **Current Candle Analysis:**
        -   Describe the candle's type (e.g., "small red bearish candle").
        -   Provide precise measurements: body size in points, upper/lower shadow length in points.
        -   Calculate the candle's full range (High - Low) in points and as a percentage of the open price.
        -   Interpret these characteristics in the context of market pressure (e.g., "indicating continued selling pressure").
        -   Add context based on the ${data.analysisType} timeframe (e.g., "showing low volatility typical for Nifty 50 continuation on 1-3 minute charts").

    2.  **Pattern Identification:**
        -   Provide a specific classification for the pattern (e.g., "Momentum Bearish," "High-Wave Spinning Top").
        -   Justify this classification based on the candle's metrics (e.g., body-to-wick ratio, direction).
        -   Explain why it is NOT other similar patterns (e.g., "lacks long wicks for a hammer," "not a doji as body is > X% of range").
        -   Explain what the pattern implies: trend continuation or potential reversal.

    3.  **Prediction:**
        -   State the most probable **Direction** (Up/Down) for the next candle.
        -   Provide a **Projected Move in Points** (a logical target, often based on the previous candle's range).
        -   Calculate the **Projected Move in Percentage** from the close.
        -   State the final **Target Price**.
        -   Crucially, define an **Invalidation Condition**: a specific price level or event that would negate the prediction (e.g., "If the next open is above the high, the bearish thesis is void").
        -   Optionally, if appropriate, provide an **Extended Target** for a higher risk/reward scenario (e.g., a 1:2 reward/risk projection).

    4.  **Volume Commentary:**
        -   Analyze how the provided volume figure (or its absence) impacts the reliability of the identified pattern and prediction.
        -   State whether the volume is confirmatory (e.g., "high volume on a bearish candle confirms selling pressure") or contradictory (e.g., "low volume suggests a lack of conviction").

    Format the entire response as a single, valid JSON object that adheres to the provided schema. Do not include any text, markdown, or explanations outside of the JSON object itself.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    return result as AnalysisResult;
  } catch (error) {
    console.error("Error analyzing candle data:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to get analysis from AI: ${error.message}`);
    }
    throw new Error("An unknown error occurred during AI analysis.");
  }
};
