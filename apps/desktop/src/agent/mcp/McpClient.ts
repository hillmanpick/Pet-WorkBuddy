import type { McpServerConfig } from "../../config/schema";

export type McpServersConfig = Record<string, McpServerConfig>;

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

// Placeholder adapter boundary. Built-in tools run directly today; external MCP
// servers can be attached behind this client without changing AgentRuntime.
export class McpClient {
  constructor(private readonly servers: McpServersConfig) {}

  listConfiguredServers(): string[] {
    return Object.keys(this.servers);
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    return [];
  }
}
