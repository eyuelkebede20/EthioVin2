import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const vehicleSpecSchema = {
  type: Type.OBJECT,
  properties: {
    engine: {
      type: Type.OBJECT,
      properties: {
        engineModel: { type: Type.STRING },
        fuelType: { type: Type.STRING },
        emissionStandard: { type: Type.STRING },
        fuelConsumption: { type: Type.STRING },
      },
    },
    // rest unchanged...
  },
};

export const generateVehicleSpecsDraft = async (manufacturer: string, year: string, model: string) => {
  const prompt = `Generate standard base specifications for a ${year} ${manufacturer} ${model}. Provide the most likely global defaults. Use metric units (mm, kg, L/100km).`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: vehicleSpecSchema,
      temperature: 0.1,
    },
  });

  const text = response.text?.() ?? response.text;

  if (!text) throw new Error("No text returned from Gemini");

  return JSON.parse(text);
};
