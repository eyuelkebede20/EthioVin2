import axios from "axios";

// Adjust this to match your Express backend port
const API_URL = import.meta.env.VITE_BACKEND_URL;

export interface ScanResponse {
  vin: string;
  hit: boolean;
  patientExists: boolean;
  data?: any; // Contains hardware_specs if hit is true
  promptAdmin?: boolean;
  extractedData?: {
    wmi: string;
    vds_code: string;
    year: string;
    manufacturer: string;
  };
  suggestedModels?: Array<{
    id: number;
    make: string;
    model: string;
  }>;
}

export const scanVin = async (vin: string): Promise<ScanResponse> => {
  // Pre-sanitize on frontend to save a network request if invalid
  const cleanVin = vin
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (cleanVin.length !== 17) {
    throw new Error("Invalid VIN format. Must be 17 characters.");
  }

  const response = await fetch(`${API_URL}/api/v1/vin/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Required for Better Auth session verification
    body: JSON.stringify({ vin: cleanVin }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to process VIN. Status: ${response.status}`);
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
    const response = await fetch(`${API_URL}/api/v1/vin/scan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // This line is required
      body: JSON.stringify({ vin }),
    });
    const data = await response.json();
    return data;
  },

  submitVerification: async (payload: VerifyPayload): Promise<{ success: boolean }> => {
    const response = await axios.post(`${API_URL}/verify`, payload);
    return response.data;
  },
  getConflicts: async (): Promise<any> => {
    const response = await axios.get(`${API_URL}/conflicts`);
    return response.data;
  },

  resolveConflict: async (wmi: string, vds_code: string, selected_spec_id: number): Promise<{ success: boolean }> => {
    const response = await axios.post(`${API_URL}/resolve`, { wmi, vds_code, selected_spec_id });
    return response.data;
  },
};
