import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  categoriesContainer,
  questionsContainer,
  usersContainer,
} from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import type { Category, Question } from "../models/index.js";

async function deleteCategory(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("deleteCategory called");

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

  // Verify category exists
  try {
    const { resource } = await categoriesContainer
      .item(categoryId, categoryId)
      .read<Category>();

    if (!resource) {
      return { status: 404, jsonBody: { error: "Category not found" } };
    }
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
    context.error(`deleteCategory read failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to read category" } };
  }

  // Delete all questions belonging to this category
  try {
    const { resources: questions } = await questionsContainer.items
      .query<Question>({
        query: "SELECT c.id, c.category FROM c WHERE c.category = @categoryId",
        parameters: [{ name: "@categoryId", value: categoryId }],
      })
      .fetchAll();

    for (const q of questions) {
      await questionsContainer.item(q.id, q.category).delete();
    }
    context.log(`Deleted ${questions.length} questions for category ${categoryId}`);
  } catch (err) {
    context.warn("Failed to clean up questions for deleted category:", err);
    // Continue with category deletion even if question cleanup fails
  }

  // Delete the category document
  try {
    await categoriesContainer.item(categoryId, categoryId).delete();
    return { status: 204 };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`deleteCategory failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to delete category" } };
  }
}

app.http("deleteCategory", {
  methods: ["DELETE"],
  authLevel: "anonymous",
  route: "categories/{categoryId}",
  handler: deleteCategory,
});
