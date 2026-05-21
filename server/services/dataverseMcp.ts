/**
 * Client for Dataverse's native MCP endpoint.
 * Sends JSON-RPC requests to https://{org}.crm.dynamics.com/api/mcp
 * using the user's MSAL Bearer token.
 */

export interface McpToolCall {
  method: string;
  params: Record<string, unknown>;
}

export interface McpResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class DataverseMcpClient {
  private orgUrl: string;
  private accessToken: string;
  private mcpEndpoint: string;

  constructor(orgUrl: string, accessToken: string) {
    this.orgUrl = orgUrl.replace(/\/+$/, '');
    this.accessToken = accessToken;
    this.mcpEndpoint = `${this.orgUrl}/api/mcp`;
  }

  /**
   * Send a JSON-RPC request to the Dataverse MCP endpoint.
   */
  async call(method: string, params: Record<string, unknown> = {}): Promise<McpResult> {
    const body = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    };

    const res = await fetch(this.mcpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return {
        success: false,
        error: `MCP ${res.status}: ${errorText.substring(0, 300)}`,
      };
    }

    const result = await res.json();

    if (result.error) {
      return {
        success: false,
        error: result.error.message ?? JSON.stringify(result.error),
      };
    }

    return {
      success: true,
      data: result.result ?? result,
    };
  }

  /**
   * Execute a step from the agent's execution plan.
   */
  async executeStep(step: McpToolCall): Promise<McpResult> {
    return this.call(step.method, step.params);
  }
}
