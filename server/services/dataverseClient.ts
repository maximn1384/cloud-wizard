/**
 * Dataverse client that calls the Dataverse Web API directly.
 * Accepts a Bearer token for authentication.
 */

interface DataverseTableInfo {
  LogicalName: string;
  DisplayName: { UserLocalizedLabel?: { Label: string } };
  SchemaName: string;
}

interface DataverseListResponse {
  value: DataverseTableInfo[];
}

export class DataverseClient {
  private orgUrl: string;
  private accessToken: string;

  constructor(orgUrl: string, accessToken: string) {
    this.orgUrl = orgUrl.replace(/\/+$/, '');
    this.accessToken = accessToken;
  }

  private authHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Quick connectivity check using WhoAmI (simplest Dataverse endpoint).
   */
  async testConnection(): Promise<{
    valid: boolean;
    tables?: string[];
    error?: string;
  }> {
    try {
      // WhoAmI is the most reliable connectivity test
      const whoAmIUrl = `${this.orgUrl}/api/data/v9.2/WhoAmI`;
      const res = await fetch(whoAmIUrl, { headers: this.authHeaders() });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Dataverse API returned ${res.status}: ${body.substring(0, 200)}`);
      }

      // If WhoAmI succeeds, try to list some tables
      let tables: string[] = [];
      try {
        tables = await this.listTables();
      } catch {
        // Connection is valid even if table listing fails
      }

      return { valid: true, tables };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, error: message };
    }
  }

  /**
   * List tables in the environment.
   */
  async listTables(): Promise<string[]> {
    const url = `${this.orgUrl}/api/data/v9.2/EntityDefinitions?$select=LogicalName`;

    const res = await fetch(url, { headers: this.authHeaders() });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Dataverse API returned ${res.status}: ${body.substring(0, 200)}`
      );
    }

    const data = (await res.json()) as DataverseListResponse;
    return data.value.map((t) => t.LogicalName);
  }

  /**
   * Describe a specific table's columns.
   */
  async describeTable(
    logicalName: string
  ): Promise<{ name: string; type: string; displayName: string }[]> {
    const url = `${this.orgUrl}/api/data/v9.2/EntityDefinitions(LogicalName='${encodeURIComponent(logicalName)}')/Attributes?$select=LogicalName,AttributeType,DisplayName`;

    const res = await fetch(url, { headers: this.authHeaders() });

    if (!res.ok) {
      throw new Error(`Failed to describe table '${logicalName}': ${res.status}`);
    }

    const data = (await res.json()) as {
      value: {
        LogicalName: string;
        AttributeType: string;
        DisplayName: { UserLocalizedLabel?: { Label: string } };
      }[];
    };

    return data.value.map((attr) => ({
      name: attr.LogicalName,
      type: attr.AttributeType,
      displayName: attr.DisplayName?.UserLocalizedLabel?.Label ?? attr.LogicalName,
    }));
  }
}

/**
 * Validate that a URL looks like a valid Dynamics 365 / Dataverse org URL.
 */
export function isValidOrgUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('.dynamics.com') ||
        parsed.hostname.endsWith('.crm.dynamics.com') ||
        parsed.hostname.endsWith('.crm2.dynamics.com') ||
        parsed.hostname.endsWith('.crm3.dynamics.com') ||
        parsed.hostname.endsWith('.crm4.dynamics.com') ||
        parsed.hostname.endsWith('.crm5.dynamics.com') ||
        parsed.hostname.endsWith('.crm6.dynamics.com') ||
        parsed.hostname.endsWith('.crm7.dynamics.com') ||
        parsed.hostname.endsWith('.crm8.dynamics.com') ||
        parsed.hostname.endsWith('.crm9.dynamics.com') ||
        parsed.hostname.endsWith('.crm11.dynamics.com'))
    );
  } catch {
    return false;
  }
}
