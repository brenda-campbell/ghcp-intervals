import { questionsContainer, categoriesContainer, gameStateContainer } from "../services/cosmosClient";
import { Category, Question, GameState } from "../models";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(__dirname, "../data");

async function seedCategories(): Promise<void> {
  const categoriesPath = path.join(DATA_DIR, "categories.json");
  const categories: Category[] = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));

  console.log(`Seeding ${categories.length} categories...`);
  let success = 0;
  let failed = 0;

  for (const cat of categories) {
    try {
      await categoriesContainer.items.upsert(cat);
      console.log(`  ✓ ${cat.name} (${cat.id})`);
      success++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Failed to upsert category ${cat.id}: ${msg}`);
    }
  }
  console.log(`Categories: ${success} succeeded, ${failed} failed\n`);
}

async function seedQuestions(): Promise<void> {
  const questionFiles = [
    "questions-technical.json",
    "questions-movies.json",
    "questions-general-knowledge.json",
    "questions-geography.json",
    "questions-physics.json",
    "questions-maths.json",
    "questions-nature.json",
    "questions-sport.json",
    "questions-manchester.json",
    "questions-edinburgh.json",
  ];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const file of questionFiles) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ File not found: ${file} — skipping`);
      continue;
    }

    const questions: Question[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`Seeding ${questions.length} questions from ${file}...`);

    let success = 0;
    let failed = 0;

    for (const q of questions) {
      try {
        await questionsContainer.items.upsert(q);
        success++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ Failed to upsert ${q.id}: ${msg}`);
      }
    }

    console.log(`  ${file}: ${success} succeeded, ${failed} failed`);
    totalSuccess += success;
    totalFailed += failed;
  }

  console.log(`\nTotal questions: ${totalSuccess} succeeded, ${totalFailed} failed\n`);
}

async function seedGameState(): Promise<void> {
  console.log("Seeding initial game state...");
  const gameState: GameState = {
    id: "current",
    activeCategoryId: "technical",
    activeCategoryName: "Technical",
    activeQuestionFormat: "multiple-choice",
    isStarted: false,
    updatedAt: new Date().toISOString(),
    updatedBy: "seed-script",
  };

  try {
    await gameStateContainer.items.upsert(gameState);
    console.log("  ✓ Game state set to 'Technical'\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to seed game state: ${msg}\n`);
  }
}

async function seed(): Promise<void> {
  console.log("=== Fastest Finger Quiz — Full Seed ===\n");
  await seedCategories();
  await seedQuestions();
  await seedGameState();
  console.log("=== Seed complete ===");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
