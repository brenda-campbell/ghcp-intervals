import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { categoriesContainer, usersContainer } from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import { randomUUID } from "crypto";
import type { Category, QuestionType } from "../models/index.js";

async function createCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("createCategory called");

  try {
    await requireAdmin(request, usersContainer);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      "message" in err
    ) {
      const typed = err as { status: number; message: string };
      return { status: typed.status, jsonBody: { error: typed.message } };
    }
    return { status: 403, jsonBody: { error: "Authorization failed" } };
  }

  let body: { name?: string; description?: string; questionFormat?: QuestionType };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  const { name, description, questionFormat } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { status: 400, jsonBody: { error: "Name is required and must be non-empty" } };
  }

  // Check for duplicate name (case-insensitive)
  try {
    const { resources: existing } = await categoriesContainer.items
      .query<Category>({
        query: "SELECT * FROM c WHERE LOWER(c.name) = LOWER(@name)",
        parameters: [{ name: "@name", value: name.trim() }],
      })
      .fetchAll();

    if (existing.length > 0) {
      return { status: 409, jsonBody: { error: "A category with this name already exists" } };
    }
  } catch (err) {
    context.error("Duplicate check failed:", err);
    return { status: 500, jsonBody: { error: "Failed to check for duplicate category" } };
  }

  const category: Category = {
    id: randomUUID(),
    name: name.trim(),
    description: description ?? "",
    questionFormat: questionFormat ?? "multiple-choice",
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  try {
    const { resource: created } = await categoriesContainer.items.upsert(category);
    return { status: 201, jsonBody: created };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`createCategory failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to create category" } };
  }
}

app.http("createCategory", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "categories",
  handler: createCategory,
});
