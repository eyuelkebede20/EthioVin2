import { pgTable, serial, jsonb, varchar, integer, primaryKey, index, uniqueIndex, pgEnum, timestamp, foreignKey } from "drizzle-orm/pg-core";
import { text, boolean } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["pending", "verified", "rejected", "conflict"]);
export const fuelEnum = pgEnum("fuel", ["petrol", "diesel", "hybrid", "electric"]);
export const transEnum = pgEnum("transmission", ["manual", "automatic", "cvt"]);
export const bodyStyleEnum = pgEnum("body_style", ["sedan", "suv", "hatchback", "single_cab", "double_cab", "minivan", "van", "truck"]);

export const wmi_mapping = pgTable("wmi_mapping", {
  wmi: varchar("wmi", { length: 3 }).primaryKey(),
  manufacturer: varchar("manufacturer", { length: 100 }).notNull().default("Unknown"),
});

export const nhtsa_models = pgTable("nhtsa_models", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  make: varchar("make", { length: 100 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
});

export const vehicle_specs = pgTable("vehicle_specs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  hardware_specs: jsonb("hardware_specs").notNull(),
});

export const vds_cache = pgTable(
  "vds_cache",
  {
    wmi: varchar("wmi", { length: 3 })
      .notNull()
      .references(() => wmi_mapping.wmi),
    vds_code: varchar("vds_code", { length: 6 }).notNull(), // Change from 5 to 6 to handle full DNA
    spec_id: integer("spec_id")
      .references(() => vehicle_specs.id)
      .notNull(),
    status: statusEnum("status").default("pending").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.wmi, table.vds_code] }),
    wmiVdsIdx: index("wmi_vds_search_idx").on(table.wmi, table.vds_code),
  }),
);

export const verification_log = pgTable(
  "verification_log",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    wmi: varchar("wmi", { length: 3 }).notNull(),
    vds_code: varchar("vds_code", { length: 5 }).notNull(),
    proposed_spec_id: integer("proposed_spec_id")
      .references(() => vehicle_specs.id)
      .notNull(),
    admin_id: integer("admin_id").notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    fk: foreignKey({
      columns: [table.wmi, table.vds_code],
      foreignColumns: [vds_cache.wmi, vds_cache.vds_code],
    }),
  }),
);
// Define the exact roles
export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "garage_admin",
  "diagnostician",
  "insurance",
  "user",
  // Add any of the suggested ones here if you want them
]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  role: userRoleEnum("role").default("user").notNull(),

  // REQUIRED BY BETTER AUTH ADMIN PLUGIN:
  banned: boolean("banned"),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),

  // REQUIRED BY BETTER AUTH ADMIN PLUGIN:
  impersonatedBy: text("impersonatedBy"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});
export const vehicle_ledger = pgTable(
  "vehicle_ledger",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    vin: varchar("vin", { length: 17 }).notNull().unique(),
    manufacturer: text("manufacturer").notNull(),
    year: text("year").notNull(),
    model: text("model").notNull(), // Manually inputted by diagnostician
    image_url: text("image_url"),
    // Base Decoded Facts
    wmi: text("wmi"),
    vds: text("vds"),
    vis: text("vis"),
    plant: text("plant"),
    country: text("country"),

    // The verified JSON object (Engine, Transmission, Dimensions, etc.)
    hardware_specs: jsonb("hardware_specs").notNull(),

    // Audit Trail
    scannedBy: text("scannedBy")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    // Creates a fast lookup index on the VIN column
    vinIdx: index("vin_search_idx").on(table.vin),
  }),
);
