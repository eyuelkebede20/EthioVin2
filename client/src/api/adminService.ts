import { api } from "./client";

export interface UnknownWMI {
  wmi: string;
  manufacturer: string;
  country: string | null;
  updated_at: string;
}

export const getUnknownWMIs = () => api<UnknownWMI[]>("/api/v1/admin/wmi/unknown");

export const getManufacturers = () => api<string[]>("/api/v1/admin/wmi/manufacturers");

export const updateWMI = (input: { wmi: string; manufacturer: string; country?: string }) =>
  api<{ success: boolean }>("/api/v1/admin/wmi/update", { method: "PUT", body: input });
