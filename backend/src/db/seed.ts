import "dotenv/config";
import { db } from "./index.ts";
import { nhtsa_models, wmi_mapping } from "./schema.ts";
import axios from "axios";

const WMI_SEED_DATA = [
  { wmi: "JTD", manufacturer: "TOYOTA" },
  { wmi: "JT1", manufacturer: "TOYOTA" },
  { wmi: "JTE", manufacturer: "TOYOTA" },
  { wmi: "MR0", manufacturer: "TOYOTA" },
  { wmi: "AHT", manufacturer: "TOYOTA" },
  { wmi: "KMH", manufacturer: "HYUNDAI" },
  { wmi: "KNA", manufacturer: "KIA" },
  { wmi: "JN1", manufacturer: "NISSAN" },
  { wmi: "JS1", manufacturer: "SUZUKI" },
  { wmi: "MA3", manufacturer: "SUZUKI" },
  { wmi: "WVW", manufacturer: "VOLKSWAGEN" },
];

const TARGET_MAKES = [
  "Toyota",
  "Hyundai",
  "Suzuki",
  "Nissan",
  "Jeep",
  "BYD",
  "Tesla",
  "Sinotruk",
  "Ford",
  "Chevrolet",
  "Kia",
  "Honda",
  "BMW",
  "Mercedes-Benz",
  "Volkswagen",
  "Lexus",
  "Isuzu",
  "Mitsubishi",
  "Peugeot",
  "Renault",
  "Mazda",
  "Changan",
  "Chery",
  "Geely",
  "Lifan",
  "Tata",
  "Mahindra",
];

// Helper function to pause execution
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function seedDatabase() {
  console.log("🌱 Starting Database Seeding...");

  try {
    console.log("Inserting WMI mappings...");
    await db.insert(wmi_mapping).values(WMI_SEED_DATA).onConflictDoNothing({ target: wmi_mapping.wmi });
    console.log("✅ WMI mappings seeded.");

    console.log("Fetching models from NHTSA...");

    for (const make of TARGET_MAKES) {
      console.log(`Fetching models for ${make}...`);

      try {
        const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${make}?format=json`;

        // Added a 10-second timeout to prevent hanging connections
        const response = await axios.get(url, { timeout: 10000 });
        const modelsData = response.data.Results;

        if (!modelsData || modelsData.length === 0) {
          console.log(`⚠️ No models found for ${make}. Skipping.`);
          continue;
        }

        const formattedModels = modelsData.map((item: any) => ({
          make: make,
          model: item.Model_Name.trim().toUpperCase(),
        }));

        const uniqueModels = Array.from(new Set(formattedModels.map((m: any) => m.model))).map((modelName) => ({ make, model: modelName as string }));

        await db.insert(nhtsa_models).values(uniqueModels).onConflictDoNothing();

        console.log(`✅ ${make} seeded.`);
      } catch (reqError: any) {
        // Catch the error for this specific make and continue to the next one
        console.error(`❌ Network error fetching ${make}: ${reqError.message}. Skipping.`);
      }

      // Wait 1.5 seconds before hitting the API again to prevent rate-limiting/ECONNRESET
      await delay(1500);
    }

    console.log("🏁 NHTSA Models seeding process finished.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Critical failure in seeding script:", error);
    process.exit(1);
  }
}

seedDatabase();
