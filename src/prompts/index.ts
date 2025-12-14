/**
 * MCP Prompts for Payrolla
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Generate prompt template for budget simulation
 */
function getBudgetSimulationPrompt(employeeCount: string, scenarioType?: string): string {
  const scenarioText = scenarioType || 'any type of';
  return `You are helping calculate a payroll budget simulation for Turkish employees.

The user has ${employeeCount} employees. They want to simulate a ${scenarioText} scenario.

**Your task:**

1. First, ask the user for each employee's details:
   - Name
   - Current salary amount
   - Whether it's Net or Gross salary

2. Ask about the scenario parameters they want to simulate:
   - Salary raise percentage (e.g., 10% for a 10% raise)
   - New minimum wage if different from current (current 2025: 26,005.50 TL gross)
   - Tax bracket changes if any

3. Use the **simulate_budget** tool with the collected data to calculate results.

4. Present a clear summary showing:
   - Current state vs. scenario comparison
   - Total yearly cost difference
   - Per-employee breakdown

**Important:** All monetary values should be in Turkish Lira (TL). Use the 2025 default parameters as baseline unless the user specifies otherwise.`;
}

/**
 * Generate prompt template for salary raise analysis
 */
function getSalaryRaiseAnalysisPrompt(raisePercentages: string): string {
  return `You are analyzing the cost impact of different salary raise scenarios for Turkish employees.

The user wants to compare these raise percentages: ${raisePercentages}

**Your task:**

1. Ask the user for their employee list:
   - Each employee's name
   - Current salary (Net or Gross)
   - Salary type (Net or Gross)

2. Use the **compare_scenarios** tool to calculate all raise scenarios side by side.
   - Create one scenario for each raise percentage
   - Use 12 period count for yearly calculation

3. Present results in a clear comparison table:
   - Scenario name
   - Total yearly cost
   - Cost difference from baseline (0% raise)
   - Percentage change

4. Provide a recommendation on the most cost-effective option.

**Note:** The comparison uses Turkish payroll rules including progressive income tax, SSI contributions, and stamp tax.`;
}

/**
 * Generate prompt template for year planning
 */
function getYearPlanningPrompt(planningYear: string): string {
  return `You are helping plan the ${planningYear} payroll budget for a Turkish company.

**Your task:**

1. First, use **get_default_params** to show the current ${planningYear} parameters:
   - Minimum wage (gross and net)
   - SSI contribution limits
   - Income tax brackets
   - Stamp tax ratio

2. Ask the user about their workforce:
   - Number of employees
   - Current salaries for each employee

3. Ask about expected changes for ${planningYear}:
   - Expected minimum wage increase (if any)
   - Expected tax bracket adjustments
   - Planned salary raises for employees

4. Use **simulate_budget** to calculate:
   - Current cost (no changes)
   - Projected cost with expected changes

5. Provide a comprehensive summary:
   - Monthly and yearly cost projections
   - Budget increase/decrease compared to current
   - Per-employee cost breakdown
   - Recommendations for budget planning

**Currency:** All values in Turkish Lira (TL)`;
}

/**
 * Register MCP prompts
 */
export function registerPrompts(server: McpServer): void {
  // Prompt: budget_simulation
  server.prompt(
    'budget_simulation',
    'Simulate yearly payroll budget with custom scenarios like salary raises, minimum wage changes, or tax adjustments',
    {
      employee_count: z.string().describe('Number of employees to simulate'),
      scenario_type: z.string().optional().describe('Type of scenario: raise, min_wage_change, tax_change, or combined'),
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getBudgetSimulationPrompt(
                args.employee_count || '(unspecified)',
                args.scenario_type
              ),
            },
          },
        ],
      };
    }
  );

  // Prompt: salary_raise_analysis
  server.prompt(
    'salary_raise_analysis',
    'Analyze the cost impact of giving different salary raise percentages',
    {
      raise_percentages: z.string().describe('Comma-separated raise percentages to compare (e.g., "5,10,15")'),
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getSalaryRaiseAnalysisPrompt(args.raise_percentages || '5,10,15'),
            },
          },
        ],
      };
    }
  );

  // Prompt: year_planning
  server.prompt(
    'year_planning',
    'Plan yearly payroll considering potential minimum wage and tax changes',
    {
      planning_year: z.string().describe('Year to plan for (e.g., 2025)'),
    },
    async (args) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: getYearPlanningPrompt(args.planning_year || '2025'),
            },
          },
        ],
      };
    }
  );
}
