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
import type { Category, User } from "../models/index.js";

async function listCategories(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("listCategories called");

  // Determine if caller is admin (best-effort, no auth required)
  let isAdmin = false;
  const userId = request.headers.get("x-user-id");
  if (userId) {
    try {
      const { resource } = await usersContainer.item(userId, userId).read<User>();
      if (resource?.isAdmin === true) {
        isAdmin = true;
      }
    } catch {
      // Not an admin or user not found — that's fine
    }
  }

  try {
    const { resources: categories } = await categoriesContainer.items
      .query<Category>("SELECT * FROM c ORDER BY c.name ASC")
      .fetchAll();

    // Count questions per category
    for (const category of categories) {
      try {
        const { resources: countResult } = await questionsContainer.items
          .query<number>({
            query: "SELECT VALUE COUNT(1) FROM c WHERE c.category = @categoryId",
            parameters: [{ name: "@categoryId", value: category.id }],
          })
          .fetchAll();
        category.questionCount = countResult[0] ?? 0;
      } catch {
        category.questionCount = 0;
      }
    }

    // Non-admin callers only see active categories
    const result = isAdmin
      ? categories
      : categories.filter((c) => c.isActive);

    return { status: 200, jsonBody: { categories: result } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`listCategories failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to list categories" } };
  }
}

app.http("listCategories", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "categories",
  handler: listCategories,
});
