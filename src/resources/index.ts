/**
 * MCP Resources for Payrolla
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DEFAULT_PARAMS_2025 } from '../types/index.js';

/**
 * Register MCP resources
 */
export function registerResources(server: McpServer): void {
  // Register 2025 defaults resource
  server.resource(
    '2025 Turkish Payroll Defaults',
    'payrolla://defaults/2025',
    {
      description: 'Default payroll parameters for Turkey in 2025 including minimum wage, SSI limits, and tax brackets',
      mimeType: 'application/json',
    },
    async () => {
      return {
        contents: [
          {
            uri: 'payrolla://defaults/2025',
            mimeType: 'application/json',
            text: JSON.stringify(DEFAULT_PARAMS_2025, null, 2),
          },
        ],
      };
    }
  );
}
