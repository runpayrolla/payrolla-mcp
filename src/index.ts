#!/usr/bin/env node
/**
 * Payrolla MCP Server
 *
 * MCP server for Turkish payroll calculations and budget simulations.
 * Enables LLMs to calculate payroll, simulate budgets, and compare scenarios.
 *
 * Usage:
 *   npx payrolla-mcp
 *
 * Environment:
 *   PAYROLLA_API_KEY - Required API key for Payrolla service
 *   PAYROLLA_DEBUG   - Optional, set to 'true' for debug logging
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Check for API key
  if (!process.env.PAYROLLA_API_KEY) {
    console.error('Error: PAYROLLA_API_KEY environment variable is required');
    console.error('');
    console.error('Set it in your MCP client configuration or run:');
    console.error('  export PAYROLLA_API_KEY=pk_live_xxxxx');
    process.exit(1);
  }

  // Debug mode
  const debug = process.env.PAYROLLA_DEBUG === 'true';
  if (debug) {
    console.error('[payrolla-mcp] Starting in debug mode...');
  }

  try {
    // Create server
    const server = createServer();

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    if (debug) {
      console.error('[payrolla-mcp] Server connected via stdio');
    }

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      if (debug) {
        console.error('[payrolla-mcp] Shutting down...');
      }
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      if (debug) {
        console.error('[payrolla-mcp] Shutting down...');
      }
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
