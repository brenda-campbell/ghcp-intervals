import { CosmosClient, Database, Container } from "@azure/cosmos";

const connectionString = process.env.CosmosDBConnectionString ?? "";

const client = new CosmosClient(connectionString);

const DATABASE_NAME = "fastestfinger";
const USERS_CONTAINER = "users";
const QUESTIONS_CONTAINER = "questions";

export const database: Database = client.database(DATABASE_NAME);
export const usersContainer: Container = database.container(USERS_CONTAINER);
export const questionsContainer: Container = database.container(QUESTIONS_CONTAINER);
