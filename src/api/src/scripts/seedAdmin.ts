/**
 * Seed Admin Script
 *
 * Sets brencampbell@microsoft.com as the first admin user in Cosmos DB.
 *
 * Usage:
 *   cd src/api
 *   npm run seed:admin
 *
 * Requires environment variables for Cosmos DB connection
 * (CosmosDBConnectionString, or COSMOS_ENDPOINT + identity credentials).
 */

import { randomUUID } from "crypto";
import { usersContainer } from "../services/cosmosClient";
import { User } from "../models";

const ADMIN_EMAIL = "brencampbell@microsoft.com";

async function seedAdmin(): Promise<void> {
  console.log(`Looking for user with email "${ADMIN_EMAIL}"...`);

  const { resources } = await usersContainer.items
    .query<User>({
      query: "SELECT * FROM c WHERE c.email = @email",
      parameters: [{ name: "@email", value: ADMIN_EMAIL }],
    })
    .fetchAll();

  if (resources.length > 0) {
    const existing = resources[0];
    console.log(`  Found existing user: ${existing.id} (${existing.displayName})`);

    existing.isAdmin = true;
    existing.isActive = true;
    existing.updatedAt = new Date().toISOString();

    await usersContainer.item(existing.id, existing.userId).replace(existing);
    console.log("  ✔ Updated user — isAdmin: true, isActive: true");
  } else {
    console.log("  No existing user found. Creating new admin user...");

    const now = new Date().toISOString();
    const id = randomUUID();

    const newUser: User = {
      id,
      userId: id,
      email: ADMIN_EMAIL,
      displayName: "Brenda",
      isAdmin: true,
      isActive: true,
      totalScore: 0,
      gamesPlayed: 0,
      fastestTimeMs: 0,
      createdAt: now,
      updatedAt: now,
    };

    await usersContainer.items.create(newUser);
    console.log(`  ✔ Created admin user with id: ${id}`);
  }

  console.log("\nAdmin seed complete.");
}

seedAdmin().catch((err) => {
  console.error("Admin seed failed:", err);
  process.exit(1);
});
