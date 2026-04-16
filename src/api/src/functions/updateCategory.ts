import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { categoriesContainer, usersContainer } from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import type { Category, QuestionType } from "../models/index.js";

async function updateCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("updateCategory called");

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

  const categoryId = request.params.categoryId;
  if (!categoryId) {
    return { status: 400, jsonBody: { error: "Missing categoryId parameter" } };
  }

  // Read existing category
  let existing: Category | undefined;
  try {
    const { resource } = await categoriesContainer
      .item(categoryId, categoryId)
      .read<Category>();
    existing = resource;
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 404
    ) {
      return { status: 404, jsonBody: { error: "Category not found" } };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`updateCategory read failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to read category" } };
  }

  if (!existing) {
    return { status: 404, jsonBody: { error: "Category not found" } };
  }

  let body: {
    name?: string;
    description?: string;
    questionFormat?: QuestionType;
    isActive?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  // If name is changing, check for duplicates
  if (body.name && body.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
    try {
      const { resources: dupes } = await categoriesContainer.items
        .query<Category>({
          query: "SELECT * FROM c WHERE LOWER(c.name) = LOWER(@name) AND c.id != @id",
          parameters: [
            { name: "@name", value: body.name.trim() },
            { name: "@id", value: categoryId },
          ],
        })
        .fetchAll();

      if (dupes.length > 0) {
        return { status: 409, jsonBody: { error: "A category with this name already exists" } };
      }
    } catch (err) {
      context.error("Duplicate check failed:", err);
      return { status: 500, jsonBody: { error: "Failed to check for duplicate category" } };
    }
  }

  // Merge fields
  const updated: Category = {
    ...existing,
    ...(body.name !== undefined && { name: body.name.trim() }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.questionFormat !== undefined && { questionFormat: body.questionFormat }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    updatedAt: new Date().toISOString(),
  } as Category & { updatedAt: string };

  try {
    const { resource: replaced } = await categoriesContainer
      .item(categoryId, categoryId)
      .replace(updated);
    return { status: 200, jsonBody: replaced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`updateCategory failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to update category" } };
  }
}

app.http("updateCategory", {
  methods: ["PATCH"],
  authLevel: "anonymous",
  route: "categories/{categoryId}",
  handler: updateCategory,
});
