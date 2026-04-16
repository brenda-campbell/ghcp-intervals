import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
  output,
} from "@azure/functions";
import {
  usersContainer,
  categoryScoresContainer,
} from "../services/cosmosClient.js";
import { requireAdmin } from "../services/adminAuth.js";
import type { User, CategoryScore } from "../models/index.js";

const signalROutput = output.generic({
  type: "signalR",
  name: "signalRMessages",
  hubName: "gameHub",
  connectionStringSetting: "AzureSignalRConnectionString",
});

interface ResetRequest {
  scope: "all" | "selected";
  userIds?: string[];
  categoryId?: string;
}

async function resetScores(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("resetScores called");

  let admin: User;
  try {
    admin = await requireAdmin(request, usersContainer);
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

  let body: ResetRequest;
  try {
    body = (await request.json()) as ResetRequest;
  } catch {
    return { status: 400, jsonBody: { error: "Invalid JSON body" } };
  }

  if (!body.scope || !["all", "selected"].includes(body.scope)) {
    return {
      status: 400,
      jsonBody: { error: 'scope must be "all" or "selected"' },
    };
  }

  if (
    body.scope === "selected" &&
    (!Array.isArray(body.userIds) || body.userIds.length === 0)
  ) {
    return {
      status: 400,
      jsonBody: { error: "userIds required when scope is selected" },
    };
  }

  try {
    let usersAffected = 0;
    const categoryOnly = !!body.categoryId;

    if (body.scope === "all") {
      // Query all users
      const { resources: allUsers } = await usersContainer.items
        .query<User>({ query: "SELECT * FROM c" })
        .fetchAll();

      if (!categoryOnly) {
        // Reset global scores on each user
        for (const user of allUsers) {
          user.totalScore = 0;
          user.gamesPlayed = 0;
          user.fastestTimeMs = 0;
          user.updatedAt = new Date().toISOString();
          await usersContainer.items.upsert(user);
          usersAffected++;
        }
      } else {
        usersAffected = allUsers.length;
      }

      // Delete category scores
      await deleteCategoryScores(body.categoryId);
    } else {
      // scope === "selected"
      const userIds = body.userIds!;
      for (const uid of userIds) {
        try {
          const { resource: user } = await usersContainer
            .item(uid, uid)
            .read<User>();
          if (!user) continue;

          if (!categoryOnly) {
            user.totalScore = 0;
            user.gamesPlayed = 0;
            user.fastestTimeMs = 0;
            user.updatedAt = new Date().toISOString();
            await usersContainer.items.upsert(user);
          }
          usersAffected++;

          // Delete this user's category scores
          await deleteCategoryScoresForUser(uid, body.categoryId);
        } catch (err) {
          context.warn(`Failed to reset user ${uid}: ${err}`);
        }
      }
    }

    // Broadcast scoresReset event
    context.extraOutputs.set(signalROutput, [
      {
        target: "scoresReset",
        arguments: [
          {
            resetAt: new Date().toISOString(),
            resetBy: admin.userId,
            scope: body.scope,
            usersAffected,
          },
        ],
      },
    ]);

    return {
      status: 200,
      jsonBody: { reset: true, usersAffected },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    context.error(`resetScores failed: ${message}`);
    return { status: 500, jsonBody: { error: "Failed to reset scores" } };
  }
}

/** Delete category score documents, optionally filtered by categoryId */
async function deleteCategoryScores(categoryId?: string): Promise<void> {
  let query: string;
  let parameters: { name: string; value: string }[] = [];

  if (categoryId) {
    query = "SELECT c.id, c.categoryId FROM c WHERE c.categoryId = @catId";
    parameters = [{ name: "@catId", value: categoryId }];
  } else {
    query = "SELECT c.id, c.categoryId FROM c";
  }

  const { resources: docs } = await categoryScoresContainer.items
    .query<Pick<CategoryScore, "id" | "categoryId">>({ query, parameters })
    .fetchAll();

  for (const doc of docs) {
    await categoryScoresContainer.item(doc.id, doc.categoryId).delete();
  }
}

/** Delete category scores for a specific user, optionally filtered by categoryId */
async function deleteCategoryScoresForUser(
  userId: string,
  categoryId?: string
): Promise<void> {
  let query: string;
  let parameters: { name: string; value: string }[] = [
    { name: "@userId", value: userId },
  ];

  if (categoryId) {
    query =
      "SELECT c.id, c.categoryId FROM c WHERE c.userId = @userId AND c.categoryId = @catId";
    parameters.push({ name: "@catId", value: categoryId });
  } else {
    query = "SELECT c.id, c.categoryId FROM c WHERE c.userId = @userId";
  }

  const { resources: docs } = await categoryScoresContainer.items
    .query<Pick<CategoryScore, "id" | "categoryId">>({ query, parameters })
    .fetchAll();

  for (const doc of docs) {
    await categoryScoresContainer.item(doc.id, doc.categoryId).delete();
  }
}

app.http("resetScores", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "scores/reset",
  extraOutputs: [signalROutput],
  handler: resetScores,
});
