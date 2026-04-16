import { CosmosClient, Database, Container } from "@azure/cosmos";
import { DefaultAzureCredential, AccessToken, TokenCredential, GetTokenOptions } from "@azure/identity";

const connectionString = process.env.CosmosDBConnectionString ?? "";
const cosmosEndpoint = process.env.COSMOS_ENDPOINT ?? "";

// SWA managed functions expose IDENTITY_ENDPOINT without IDENTITY_HEADER.
// The @azure/identity ManagedIdentityCredential expects both, so we call
// the MSI endpoint directly.
class SwaMsiCredential implements TokenCredential {
  async getToken(scopes: string | string[], _options?: GetTokenOptions): Promise<AccessToken> {
    const resource = (Array.isArray(scopes) ? scopes[0] : scopes).replace(/\/.default$/, "");
    const endpoint = process.env.IDENTITY_ENDPOINT ?? process.env.MSI_ENDPOINT;
    if (!endpoint) throw new Error("No MSI endpoint available");

    const url = `${endpoint}?api-version=2019-08-01&resource=${encodeURIComponent(resource)}`;
    const headers: Record<string, string> = {};
    if (process.env.IDENTITY_HEADER) headers["X-IDENTITY-HEADER"] = process.env.IDENTITY_HEADER;

    const resp = await fetch(url, { headers });
    if (!resp.ok) throw new Error(`MSI token failed (${resp.status}): ${await resp.text()}`);
    const json = await resp.json() as { access_token: string; expires_on: string };
    return { token: json.access_token, expiresOnTimestamp: parseInt(json.expires_on, 10) * 1000 };
  }
}

function createClient(): CosmosClient {
  if (connectionString) {
    return new CosmosClient(connectionString);
  }
  const credential: TokenCredential = (process.env.IDENTITY_ENDPOINT || process.env.MSI_ENDPOINT)
    ? new SwaMsiCredential()
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
