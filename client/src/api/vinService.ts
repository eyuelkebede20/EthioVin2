import axios from "axios";

// Adjust this to match your Express backend port
const API_BASE_URL = "http://localhost:3000/api/v1/vin";

export interface ScanResponse {
  hit: boolean;
  promptAdmin?: boolean;
  extractedData?: {
    wmi: string;
    vds_code: string;
    year: number;
    manufacturer: string;
  };
  suggestedModels?: any[];
  data?: any;
  vin?: string;
}

export const scanVin = async (vin: string): Promise<ScanResponse> => {
  const response = await fetch("http://localhost:3000/api/v1/vin/scan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Required for Better Auth session verification
    body: JSON.stringify({ vin }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to process VIN");
  }

  return response.json();
};

export interface VerifyPayload {
  wmi: string;
  vds_code: string;
  model_id: number;
  year: number;
  engine_cc: number;
  fuel: "petrol" | "diesel" | "hybrid" | "electric";
  transmission: "manual" | "automatic" | "cvt";
  body_style: "sedan" | "suv" | "hatchback" | "single_cab" | "double_cab" | "minivan" | "van" | "truck";
  admin_id: number;
}

export const vinService = {
  scanVin: async (vin: string): Promise<ScanResponse> => {
    const response = await fetch("http://localhost:3000/api/v1/vin/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // This line is required
      body: JSON.stringify({ vin }),
    });
    return response.data;
  },

  submitVerification: async (payload: VerifyPayload): Promise<{ success: boolean }> => {
    const response = await axios.post(`${API_BASE_URL}/verify`, payload);
    return response.data;
  },
  getConflicts: async (): Promise<any> => {
    const response = await axios.get(`${API_BASE_URL}/conflicts`);
    return response.data;
  },

  resolveConflict: async (wmi: string, vds_code: string, selected_spec_id: number): Promise<{ success: boolean }> => {
    const response = await axios.post(`${API_BASE_URL}/resolve`, { wmi, vds_code, selected_spec_id });
    return response.data;
  },
};
