import { CosmosClient, Database, Container } from "@azure/cosmos";
import { ClientSecretCredential, DefaultAzureCredential } from "@azure/identity";

const connectionString = process.env.CosmosDBConnectionString ?? "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? "";

function createClient(): CosmosClient {
  if (connectionString) {
    return new CosmosClient(connectionString);
  }
  // Use service principal when credentials are available (Azure),
  // otherwise DefaultAzureCredential for local dev (az login).
  const credential = process.env.AZURE_CLIENT_SECRET
    ? new ClientSecretCredential(
        process.env.AZURE_TENANT_ID!,
        process.env.AZURE_CLIENT_ID!,
        process.env.AZURE_CLIENT_SECRET
      )
    : new DefaultAzureCredential();
  return new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
}

const client = createClient();

const DATABASE_NAME = "fastestfinger";
const USERS_CONTAINER = "users";
const QUESTIONS_CONTAINER = "questions";
const CATEGORIES_CONTAINER = "categories";
const CATEGORY_SCORES_CONTAINER = "categoryScores";
const GAME_STATE_CONTAINER = "gameState";

export const database: Database = client.database(DATABASE_NAME);
export const usersContainer: Container = database.container(USERS_CONTAINER);
export const questionsContainer: Container = database.container(QUESTIONS_CONTAINER);
export const categoriesContainer: Container = database.container(CATEGORIES_CONTAINER);
export const categoryScoresContainer: Container = database.container(CATEGORY_SCORES_CONTAINER);
export const gameStateContainer: Container = database.container(GAME_STATE_CONTAINER);
