/**
 * Parameter and simulation tools for MCP server
 */

import { PayrollaClient } from 'payrolla';
import type {
  SimulateBudgetInput,
  SimulateBudgetResult,
  CompareScenariosInput,
  CompareScenariosResult,
  GetDefaultParamsInput,
  DefaultParamsResult,
  CustomParams,
  ScenarioConfig,
} from '../types/index.js';
import { DEFAULT_PARAMS_2025 } from '../types/index.js';
import { calculateBulkPayroll } from './calculate.js';

/**
 * Get default parameters for a given year
 */
export function getDefaultParams(input: GetDefaultParamsInput): DefaultParamsResult {
  // Currently only 2025 is supported
  // In the future, this could fetch from a database or API
  if (input.year === 2025) {
    return DEFAULT_PARAMS_2025;
  }

  // Return 2025 defaults for other years with a note
  return {
    ...DEFAULT_PARAMS_2025,
    year: input.year,
  };
}

/**
 * Apply scenario modifications to get effective parameters
 */
function applyScenario(
  defaults: DefaultParamsResult,
  scenario: ScenarioConfig
): CustomParams {
  const result: CustomParams = {};

  // Apply custom min wage
  if (scenario.minWage !== undefined) {
    result.minWage = scenario.minWage;
  }
  if (scenario.minWageNet !== undefined) {
    result.minWageNet = scenario.minWageNet;
  }

  // Apply SSI limit increase
  if (scenario.ssiLimitIncreasePercent !== undefined) {
    const multiplier = 1 + scenario.ssiLimitIncreasePercent / 100;
    result.ssiLowerLimit = defaults.ssiLowerLimit * multiplier;
    result.ssiUpperLimit = defaults.ssiUpperLimit * multiplier;
  }

  // Apply tax limit increase or custom brackets
  if (scenario.customTaxBrackets !== undefined) {
    result.incomeTaxLimits = scenario.customTaxBrackets;
  } else if (scenario.taxLimitIncreasePercent !== undefined) {
    const multiplier = 1 + scenario.taxLimitIncreasePercent / 100;
    result.incomeTaxLimits = defaults.incomeTaxBrackets.map((bracket) => ({
      limit: bracket.limit === Number.MAX_SAFE_INTEGER
        ? bracket.limit
        : Math.round(bracket.limit * multiplier),
      rate: bracket.rate,
    }));
  }

  return result;
}

/**
 * Apply salary raise to wage
 */
function applyRaise(wage: number, raisePercent?: number): number {
  if (raisePercent === undefined || raisePercent === 0) {
    return wage;
  }
  return wage * (1 + raisePercent / 100);
}

/**
 * Simulate budget with what-if scenario modifications
 */
export async function simulateBudget(
  client: PayrollaClient,
  input: SimulateBudgetInput
): Promise<SimulateBudgetResult> {
  const { employees, year, periodCount, scenario } = input;
  const defaults = getDefaultParams({ year });

  // Apply scenario to get custom params
  const customParams = applyScenario(defaults, scenario);

  // Apply salary raise to employees
  const adjustedEmployees = employees.map((emp) => ({
    name: emp.name,
    wage: applyRaise(emp.wage, scenario.salaryRaisePercent),
    calculationType: emp.calculationType as 'Gross' | 'Net',
    originalWage: emp.wage,
  }));

  // Calculate with adjusted wages and custom params
  const result = await calculateBulkPayroll(client, {
    employees: adjustedEmployees.map((emp) => ({
      name: emp.name,
      wage: emp.wage,
      calculationType: emp.calculationType,
    })),
    year,
    month: 1,
    periodCount,
    customParams,
  });

  // Build employee results with original/adjusted wages
  const employeeResults = adjustedEmployees.map((emp, index) => {
    const empResult = result.employees[index];
    return {
      name: emp.name,
      originalWage: emp.originalWage,
      adjustedWage: emp.wage,
      yearlyCost: empResult.totalCost,
      yearlyNet: empResult.totalNet,
      yearlyGross: empResult.totalGross,
    };
  });

  // Build scenario applied info
  const effectiveTaxBrackets = customParams.incomeTaxLimits || defaults.incomeTaxBrackets.map((b) => ({
    limit: b.limit,
    rate: b.rate,
  }));

  return {
    scenarioApplied: {
      salaryRaisePercent: scenario.salaryRaisePercent || 0,
      effectiveMinWage: customParams.minWage || defaults.minWage,
      effectiveMinWageNet: customParams.minWageNet || defaults.minWageNet,
      effectiveTaxBrackets,
    },
    summary: {
      totalYearlyCost: result.summary.totalYearlyCost,
      totalYearlyNet: result.summary.totalYearlyNet,
      totalYearlyGross: result.summary.totalYearlyGross,
      costPerEmployee: result.summary.totalYearlyCost / employees.length,
    },
    employees: employeeResults,
  };
}

/**
 * Compare multiple budget scenarios side by side
 */
export async function compareScenarios(
  client: PayrollaClient,
  input: CompareScenariosInput
): Promise<CompareScenariosResult> {
  const { employees, year, periodCount, scenarios } = input;

  if (scenarios.length === 0) {
    throw new Error('At least one scenario is required');
  }

  const results: Array<{
    name: string;
    totalCost: number;
  }> = [];

  // Calculate each scenario
  for (const scenario of scenarios) {
    const result = await simulateBudget(client, {
      employees,
      year,
      periodCount,
      scenario,
    });

    results.push({
      name: scenario.name || `Scenario ${results.length + 1}`,
      totalCost: result.summary.totalYearlyCost,
    });
  }

  // Use first scenario as baseline
  const baselineCost = results[0].totalCost;

  // Build comparison
  const comparison = results.map((r) => ({
    scenarioName: r.name,
    totalCost: r.totalCost,
    costDifference: r.totalCost - baselineCost,
    percentChange: baselineCost > 0
      ? ((r.totalCost - baselineCost) / baselineCost) * 100
      : 0,
  }));

  // Find cheapest and most expensive
  const sortedByCoset = [...results].sort((a, b) => a.totalCost - b.totalCost);
  const cheapestScenario = sortedByCoset[0].name;
  const mostExpensiveScenario = sortedByCoset[sortedByCoset.length - 1].name;

  return {
    baselineCost,
    comparison,
    cheapestScenario,
    mostExpensiveScenario,
  };
}
