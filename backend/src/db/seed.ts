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

        // Deduplicate in memory
        const uniqueModels = Array.from(new Set(formattedModels.map((m: any) => m.model))).map((modelName) => ({ make, model: modelName as string }));

        // Dropped chunk size to 50 for strict shared hosting environments
        const CHUNK_SIZE = 50;
        for (let i = 0; i < uniqueModels.length; i += CHUNK_SIZE) {
          const chunk = uniqueModels.slice(i, i + CHUNK_SIZE);

          try {
            // Removed onConflictDoNothing() since there is no unique index to conflict with
            await db.insert(nhtsa_models).values(chunk);
          } catch (dbError: any) {
            console.error(`\n❌ FATAL DB ERROR while inserting ${make}:`);
            // This will print the actual reason (e.g. "out of memory" or "syntax error")
            console.error(dbError.cause?.message || dbError.message);
            throw dbError; // Stop the script so you can read it
          }
        }

        console.log(`✅ ${make} seeded (${uniqueModels.length} models).`);
      } catch (reqError: any) {
        if (reqError.cause) {
          // Ignore the DB throws here so it stops the whole script, but catch network errors
          throw reqError;
        }
        console.error(`❌ Network error fetching ${make}: ${reqError.message}. Skipping.`);
      }

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
