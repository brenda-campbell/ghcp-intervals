import { CosmosClient, Database, Container } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const connectionString = process.env.CosmosDBConnectionString ?? "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? "";

const client = connectionString
  ? new CosmosClient(connectionString)
  : new CosmosClient({ endpoint: cosmosEndpoint, aadCredentials: new DefaultAzureCredential() });

const DATABASE_NAME = "fastestfinger";
const USERS_CONTAINER = "users";
const QUESTIONS_CONTAINER = "questions";

export const database: Database = client.database(DATABASE_NAME);
export const usersContainer: Container = database.container(USERS_CONTAINER);
export const questionsContainer: Container = database.container(QUESTIONS_CONTAINER);
