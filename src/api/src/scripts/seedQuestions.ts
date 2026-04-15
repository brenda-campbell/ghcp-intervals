import { questionsContainer } from "../services/cosmosClient";
import questions from "../data/questions.json";
import { Question } from "../models";

async function seed(): Promise<void> {
  console.log(`Seeding ${questions.length} questions into Cosmos DB...\n`);

  const counts: Record<string, number> = {};
  let success = 0;
  let failed = 0;

  for (const q of questions as Question[]) {
    try {
      await questionsContainer.items.upsert(q);
      counts[q.category] = (counts[q.category] ?? 0) + 1;
      success++;
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed to upsert ${q.id}: ${msg}`);
    }
  }

  console.log("Questions seeded per category:");
  for (const [category, count] of Object.entries(counts)) {
    console.log(`  ${category}: ${count}`);
  }
  console.log(`\nTotal: ${success} succeeded, ${failed} failed`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
