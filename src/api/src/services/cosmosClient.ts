import { CosmosClient, Database, Container } from "@azure/cosmos";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";

const connectionString = process.env.CosmosDBConnectionString ?? "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? "";

function createClient(): CosmosClient {
  if (connectionString) {
    return new CosmosClient(connectionString);
  }
  // Standalone Function App: ManagedIdentityCredential works out-of-the-box.
  // Falls back to DefaultAzureCredential for local development.
  const credential = process.env.WEBSITE_INSTANCE_ID
    ? new ManagedIdentityCredential()
    : new DefaultAzureCredential();
  return new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: credential });
}

const client = createClient();

const DATABASE_NAME = "fastestfinger";
const USERS_CONTAINER = "users";
const QUESTIONS_CONTAINER = "questions";

export const database: Database = client.database(DATABASE_NAME);
export const usersContainer: Container = database.container(USERS_CONTAINER);
export const questionsContainer: Container = database.container(QUESTIONS_CONTAINER);
