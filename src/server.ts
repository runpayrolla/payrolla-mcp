/**
 * Payrolla MCP Server Setup
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PayrollaClient } from 'payrolla';
import { z } from 'zod';

import {
  calculatePayroll,
  calculateBulkPayroll,
  getDefaultParams,
  simulateBudget,
  compareScenarios,
} from './tools/index.js';
import { registerResources } from './resources/index.js';
import { registerPrompts } from './prompts/index.js';

// Zod schemas for tool inputs
const ExtraPaymentSchema = z.object({
  name: z.string().describe('Name of the extra payment'),
  amount: z.number().describe('Payment amount'),
  type: z.enum(['Net', 'Gross']).describe('Payment type'),
});

const CustomParamsSchema = z.object({
  minWage: z.number().optional().describe('Custom minimum wage (gross)'),
  minWageNet: z.number().optional().describe('Custom minimum wage (net)'),
  ssiLowerLimit: z.number().optional().describe('Custom SSI lower limit'),
  ssiUpperLimit: z.number().optional().describe('Custom SSI upper limit'),
  stampTaxRatio: z.number().optional().describe('Custom stamp tax ratio'),
  incomeTaxLimits: z.array(z.object({
    limit: z.number().describe('Upper limit for this bracket'),
    rate: z.number().describe('Tax rate (e.g., 0.15 for 15%)'),
  })).optional().describe('Custom income tax brackets'),
});

const EmployeeInputSchema = z.object({
  name: z.string().describe('Employee name'),
  wage: z.number().describe('Wage amount'),
  calculationType: z.enum(['Gross', 'Net']).describe('Whether wage is gross or net'),
  ssiType: z.enum(['S4A', 'S4B', 'S4C']).optional().describe('SSI type (default: S4A)'),
  extraPayments: z.array(ExtraPaymentSchema).optional().describe('Extra payments like bonuses'),
});

const ScenarioConfigSchema = z.object({
  name: z.string().optional().describe('Scenario name for comparison'),
  salaryRaisePercent: z.number().optional().describe('Salary raise percentage (e.g., 10 for 10%)'),
  minWage: z.number().optional().describe('Custom minimum wage'),
  minWageNet: z.number().optional().describe('Custom net minimum wage'),
  taxLimitIncreasePercent: z.number().optional().describe('Increase tax bracket limits by percentage'),
  ssiLimitIncreasePercent: z.number().optional().describe('Increase SSI limits by percentage'),
  customTaxBrackets: z.array(z.object({
    limit: z.number(),
    rate: z.number(),
  })).optional().describe('Custom tax brackets'),
});

/**
 * Create and configure the MCP server
 */
export function createServer(): McpServer {
  // Get API key from environment
  const apiKey = process.env.PAYROLLA_API_KEY;
  if (!apiKey) {
    console.error('Error: PAYROLLA_API_KEY environment variable is required');
    process.exit(1);
  }

  // Create Payrolla client
  const payrollaClient = new PayrollaClient({
    apiKey,
    timeout: 30000,
  });

  // Create MCP server
  const server = new McpServer({
    name: 'payrolla-mcp',
    version: '1.0.0',
  });

  // Register tools
  registerTools(server, payrollaClient);

  // Register resources
  registerResources(server);

  // Register prompts
  registerPrompts(server);

  return server;
}

/**
 * Register MCP tools
 */
function registerTools(server: McpServer, client: PayrollaClient): void {
  // Tool: calculate_payroll
  server.tool(
    'calculate_payroll',
    'Calculate payroll for a single employee including taxes, SSI, and employer cost',
    {
      name: z.string().describe('Employee name'),
      wage: z.number().describe('Wage amount'),
      calculationType: z.enum(['Gross', 'Net']).describe('Whether the wage is gross or net'),
      ssiType: z.enum(['S4A', 'S4B', 'S4C']).optional().describe('SSI type (default: S4A for general employees)'),
      year: z.number().describe('Calculation year (e.g., 2025)'),
      month: z.number().min(1).max(12).describe('Starting month (1-12)'),
      periodCount: z.number().min(1).max(12).optional().describe('Number of months to calculate (default: 1)'),
      extraPayments: z.array(ExtraPaymentSchema).optional().describe('Extra payments like bonuses'),
      customParams: CustomParamsSchema.optional().describe('Custom global parameters to override defaults'),
    },
    async (params) => {
      try {
        const result = await calculatePayroll(client, params as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: calculate_bulk_payroll
  server.tool(
    'calculate_bulk_payroll',
    'Calculate payroll for multiple employees with shared parameters',
    {
      employees: z.array(EmployeeInputSchema).describe('Array of employees to calculate'),
      year: z.number().describe('Calculation year (e.g., 2025)'),
      month: z.number().min(1).max(12).describe('Starting month (1-12)'),
      periodCount: z.number().min(1).max(12).optional().describe('Number of months (default: 1, use 12 for yearly)'),
      customParams: CustomParamsSchema.optional().describe('Custom global parameters shared by all employees'),
    },
    async (params) => {
      try {
        const result = await calculateBulkPayroll(client, params as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: simulate_budget
  server.tool(
    'simulate_budget',
    'Simulate budget with what-if scenarios like salary raises or parameter changes',
    {
      employees: z.array(z.object({
        name: z.string().describe('Employee name'),
        wage: z.number().describe('Current wage amount'),
        calculationType: z.enum(['Gross', 'Net']).describe('Wage type'),
      })).describe('Array of employees'),
      year: z.number().describe('Calculation year'),
      periodCount: z.number().min(1).max(12).describe('Number of months (use 12 for yearly)'),
      scenario: ScenarioConfigSchema.describe('Scenario configuration with changes to apply'),
    },
    async (params) => {
      try {
        const result = await simulateBudget(client, params as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: compare_scenarios
  server.tool(
    'compare_scenarios',
    'Compare multiple budget scenarios side by side',
    {
      employees: z.array(z.object({
        name: z.string().describe('Employee name'),
        wage: z.number().describe('Current wage'),
        calculationType: z.enum(['Gross', 'Net']).describe('Wage type'),
      })).describe('Array of employees'),
      year: z.number().describe('Calculation year'),
      periodCount: z.number().min(1).max(12).describe('Number of months'),
      scenarios: z.array(ScenarioConfigSchema).min(1).describe('Array of scenarios to compare'),
    },
    async (params) => {
      try {
        const result = await compareScenarios(client, params as any);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: get_default_params
  server.tool(
    'get_default_params',
    'Get default Turkish payroll parameters for a given year',
    {
      year: z.number().describe('Year to get parameters for (e.g., 2025)'),
    },
    async (params) => {
      try {
        const result = getDefaultParams(params);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
