import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

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
    transmission: {
      type: Type.OBJECT,
      properties: {
        gearbox: { type: Type.STRING },
        type: { type: Type.STRING },
        speeds: { type: Type.INTEGER },
        driveType: { type: Type.STRING },
      },
    },
    weightAndCapacity: {
      type: Type.OBJECT,
      properties: {
        curbWeight: { type: Type.STRING },
        seats: { type: Type.INTEGER },
        doors: { type: Type.INTEGER },
      },
    },
    dimensions: {
      type: Type.OBJECT,
      properties: {
        length: { type: Type.STRING },
        width: { type: Type.STRING },
        height: { type: Type.STRING },
        wheelbase: { type: Type.STRING },
        frontTrack: { type: Type.STRING },
        rearTrack: { type: Type.STRING },
      },
    },
    tiresAndChassis: {
      type: Type.OBJECT,
      properties: {
        frontTire: { type: Type.STRING },
        rearTire: { type: Type.STRING },
      },
    },
    classification: {
      type: Type.OBJECT,
      properties: {
        bodyStyle: { type: Type.STRING },
        vehicleClass: { type: Type.STRING },
      },
    },
    marketInformation: {
      type: Type.OBJECT,
      properties: {
        msrp: { type: Type.STRING },
      },
    },
  },
};

export const generateVehicleSpecsDraft = async (manufacturer: string, year: string, model: string) => {
  const prompt = `
Generate realistic vehicle specifications in json format for:
- Manufacturer: ${manufacturer}
- Model: ${model}
- Year: ${year}

Rules:
- Use base model defaults only
- No rare trims
- Metric units only
- Conservative, realistic values
`;

  const config = {
    responseMimeType: "application/json",
    responseSchema: vehicleSpecSchema,
    temperature: 0.1,
  };

  let response;
  let retries = 3;

  // Custom Retry Loop for 503 Errors
  for (let i = 0; i < retries; i++) {
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: config,
      });
      break; // Success, exit loop
    } catch (error: any) {
      if (error.status === 503 && i < retries - 1) {
        const waitTime = (i + 1) * 2000; // Wait 2s, then 4s...
        console.warn(`[AI] 503 Server Busy. Retrying in ${waitTime / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        throw error; // Throw if it's not a 503 or we ran out of retries
      }
    }
  }

  const text = response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    console.error("Real JSON Syntax Error:", text);
    throw new Error("AI returned invalid JSON syntax");
  }

  const safeDraft = {
    engine: { engineModel: "", fuelType: "", emissionStandard: "", fuelConsumption: "", ...(parsed.engine || {}) },
    transmission: { gearbox: "", type: "", speeds: 0, driveType: "", ...(parsed.transmission || {}) },
    weightAndCapacity: { curbWeight: "", seats: 0, doors: 0, ...(parsed.weightAndCapacity || {}) },
    dimensions: { length: "", width: "", height: "", wheelbase: "", frontTrack: "", rearTrack: "", ...(parsed.dimensions || {}) },
    tiresAndChassis: { frontTire: "", rearTire: "", ...(parsed.tiresAndChassis || {}) },
    classification: { bodyStyle: "", vehicleClass: "", ...(parsed.classification || {}) },
    marketInformation: { msrp: "", ...(parsed.marketInformation || {}) },
  };

  return safeDraft;
};
