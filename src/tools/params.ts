/**
 * Parameter and simulation tools for MCP server
 */

import { PayrollaClient } from "payrolla";
import type {
  SimulateBudgetInput,
  SimulateBudgetResult,
  SimulationEmployeeResult,
  CompareScenariosInput,
  CompareScenariosResult,
  GetDefaultParamsInput,
  DefaultParamsResult,
  CustomParams,
  ScenarioConfig,
  PeriodResult,
} from "../types/index.js";
import { DEFAULT_PARAMS_2025 } from "../types/index.js";
import { calculatePayroll } from "./calculate.js";

/**
 * Get default parameters for a given year
 */
export function getDefaultParams(
  input: GetDefaultParamsInput
): DefaultParamsResult {
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
      limit:
        bracket.limit === Number.MAX_SAFE_INTEGER
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

  const employeeResults: SimulationEmployeeResult[] = [];
  let totalYearlyCost = 0;
  let totalYearlyNet = 0;
  let totalYearlyGross = 0;

  for (const emp of employees) {
    const adjustedWage = applyRaise(emp.wage, scenario.salaryRaisePercent);

    // Track cumulative values across periods
    let cumulativeIncomeTaxBase = 0;
    let cumulativeMinWageIncomeTaxBase = 0;
    let transferredSSIBase1 = 0;
    let transferredSSIBase2 = 0;

    let empTotalCost = 0;
    let empTotalNet = 0;
    let empTotalGross = 0;
    const empPeriods: PeriodResult[] = [];

    // Calculate each period separately to handle pay events
    for (let i = 0; i < periodCount; i++) {
      const calcDate = new Date(year, i, 1);
      const calcYear = calcDate.getFullYear();
      const calcMonth = calcDate.getMonth() + 1;

      // Filter pay events for this specific period
      const periodPayEvents = (emp.payEvents || []).filter(
        (pe) => pe.year === calcYear && pe.month === calcMonth
      );

      // Convert PayEvents to ExtraPayment format
      const extraPayments = periodPayEvents.map((pe) => ({
        name: pe.name,
        amount: pe.amount,
        type: pe.type as "Net" | "Gross",
        paymentType: pe.paymentType,
      }));

      const result = await calculatePayroll(client, {
        name: emp.name,
        wage: adjustedWage,
        calculationType: emp.calculationType,
        ssiType: emp.ssiType,
        year: calcYear,
        month: calcMonth,
        periodCount: 1,
        extraPayments: extraPayments.length > 0 ? extraPayments : undefined,
        customParams,
        cumulativeIncomeTaxBase,
        cumulativeMinWageIncomeTaxBase,
        transferredSSIBase1,
        transferredSSIBase2,
      });

      empTotalCost += result.totalCost;
      empTotalNet += result.totalNet;
      empTotalGross += result.totalGross;

      // Collect period result
      const lastPeriod = result.periods[0];
      empPeriods.push(lastPeriod);

      // Carry forward cumulative values
      cumulativeIncomeTaxBase = lastPeriod.cumulativeIncomeTaxBase;
      cumulativeMinWageIncomeTaxBase = lastPeriod.cumulativeMinWageIncomeTaxBase;
      transferredSSIBase1 = lastPeriod.transferredSSIBase1;
      transferredSSIBase2 = lastPeriod.transferredSSIBase2;
    }

    employeeResults.push({
      name: emp.name,
      originalWage: emp.wage,
      adjustedWage,
      yearlyCost: empTotalCost,
      yearlyNet: empTotalNet,
      yearlyGross: empTotalGross,
      periods: empPeriods,
    });

    totalYearlyCost += empTotalCost;
    totalYearlyNet += empTotalNet;
    totalYearlyGross += empTotalGross;
  }

  // Build scenario applied info
  const effectiveTaxBrackets =
    customParams.incomeTaxLimits ||
    defaults.incomeTaxBrackets.map((b) => ({
      limit: b.limit,
      rate: b.rate,
    }));

  return {
    scenarioApplied: {
      salaryRaisePercent: scenario.salaryRaisePercent || 0,
      effectiveMinWage: customParams.minWage || defaults.minWage,
      effectiveTaxBrackets,
    },
    summary: {
      totalYearlyCost,
      totalYearlyNet,
      totalYearlyGross,
      costPerEmployee: totalYearlyCost / employees.length,
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
    throw new Error("At least one scenario is required");
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
    percentChange:
      baselineCost > 0
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
