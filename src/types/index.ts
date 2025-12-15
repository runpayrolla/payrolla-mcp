/**
 * Type definitions for Payrolla MCP Server
 */

// ============ Input Types ============

/**
 * Extra payment item for an employee
 */
export interface ExtraPayment {
  name: string;
  amount: number;
  type: "Net" | "Gross";
  paymentType?: "RegularPayment" | "Overtime" | "SocialAid" | "ExtraPay" | 1 | 2 | 3 | 4;
}

/**
 * Pay event representing an extra payment at a specific month
 * Example: Quarter-end bonus, annual bonus, one-time payment
 */
export interface PayEvent {
  month: number;
  year: number;
  name: string;
  amount: number;
  type: "Net" | "Gross";
  paymentType?: "RegularPayment" | "Overtime" | "SocialAid" | "ExtraPay" | 1 | 2 | 3 | 4;
}

/**
 * Custom global parameters to override defaults
 */
export interface CustomParams {
  minWage?: number;
  ssiLowerLimit?: number;
  ssiUpperLimit?: number;
  stampTaxRatio?: number;
  incomeTaxLimits?: Array<{ limit: number; rate: number }>;
}

/**
 * Employee data for single calculation
 */
export interface EmployeeInput {
  name: string;
  wage: number;
  calculationType: "Gross" | "Net";
  ssiType?: "S4A" | "S4B" | "S4C";
  extraPayments?: ExtraPayment[];
  cumulativeIncomeTaxBase?: number;
  cumulativeMinWageIncomeTaxBase?: number;
  transferredSSIBase1?: number;
  transferredSSIBase2?: number;
}

/**
 * Input for single employee payroll calculation
 */
export interface CalculatePayrollInput {
  name: string;
  wage: number;
  calculationType: "Gross" | "Net";
  ssiType?: "S4A" | "S4B" | "S4C";
  year: number;
  month: number;
  periodCount?: number;
  extraPayments?: ExtraPayment[];
  customParams?: CustomParams;
  cumulativeIncomeTaxBase?: number;
  cumulativeMinWageIncomeTaxBase?: number;
  transferredSSIBase1?: number;
  transferredSSIBase2?: number;
}

/**
 * Input for bulk payroll calculation
 */
export interface CalculateBulkPayrollInput {
  employees: EmployeeInput[];
  year: number;
  month: number;
  periodCount?: number;
  customParams?: CustomParams;
}

/**
 * Scenario configuration for budget simulation
 */
export interface ScenarioConfig {
  name?: string;
  salaryRaisePercent?: number;
  minWage?: number;
  taxLimitIncreasePercent?: number;
  ssiLimitIncreasePercent?: number;
  customTaxBrackets?: Array<{ limit: number; rate: number }>;
}

/**
 * Input for budget simulation
 */
export interface SimulateBudgetInput {
  employees: Array<{
    name: string;
    wage: number;
    calculationType: "Gross" | "Net";
    ssiType?: "S4A" | "S4B" | "S4C";
    payEvents?: PayEvent[];
  }>;
  year: number;
  periodCount: number;
  scenario: ScenarioConfig;
}

/**
 * Input for scenario comparison
 */
export interface CompareScenariosInput {
  employees: Array<{
    name: string;
    wage: number;
    calculationType: "Gross" | "Net";
    ssiType?: "S4A" | "S4B" | "S4C";
    payEvents?: PayEvent[];
  }>;
  year: number;
  periodCount: number;
  scenarios: ScenarioConfig[];
}

/**
 * Input for getting default parameters
 */
export interface GetDefaultParamsInput {
  year: number;
}

// ============ Output Types ============

/**
 * Period result for a single calculation period
 */
export interface PeriodResult {
  year: number;
  month: number;
  grossWage: number;
  netWage: number;
  employerCost: number;
  incomeTax: number;
  stampTax: number;
  employeeSSI: number;
  employerSSI: number;
  cumulativeIncomeTaxBase: number;
  cumulativeMinWageIncomeTaxBase: number;
  transferredSSIBase1: number;
  transferredSSIBase2: number;
}

/**
 * Result for single employee calculation
 */
export interface CalculatePayrollResult {
  employee: string;
  totalCost: number;
  totalNet: number;
  totalGross: number;
  periods: PeriodResult[];
}

/**
 * Summary for bulk calculation
 */
export interface BulkSummary {
  totalEmployees: number;
  totalYearlyCost: number;
  totalYearlyNet: number;
  totalYearlyGross: number;
  averageMonthlyCost: number;
}

/**
 * Employee result in bulk calculation
 */
export interface BulkEmployeeResult {
  name: string;
  totalCost: number;
  totalNet: number;
  totalGross: number;
}

/**
 * Result for bulk payroll calculation
 */
export interface CalculateBulkPayrollResult {
  summary: BulkSummary;
  employees: BulkEmployeeResult[];
}

/**
 * Scenario applied details
 */
export interface ScenarioApplied {
  salaryRaisePercent: number;
  effectiveMinWage: number;
  effectiveTaxBrackets: Array<{ limit: number; rate: number }>;
}

/**
 * Simulation summary
 */
export interface SimulationSummary {
  totalYearlyCost: number;
  totalYearlyNet: number;
  totalYearlyGross: number;
  costPerEmployee: number;
}

/**
 * Employee result in simulation
 */
export interface SimulationEmployeeResult {
  name: string;
  originalWage: number;
  adjustedWage: number;
  yearlyCost: number;
  yearlyNet: number;
  yearlyGross: number;
  periods: PeriodResult[];
}

/**
 * Result for budget simulation
 */
export interface SimulateBudgetResult {
  scenarioApplied: ScenarioApplied;
  summary: SimulationSummary;
  employees: SimulationEmployeeResult[];
}

/**
 * Comparison entry for a single scenario
 */
export interface ScenarioComparison {
  scenarioName: string;
  totalCost: number;
  costDifference: number;
  percentChange: number;
}

/**
 * Result for scenario comparison
 */
export interface CompareScenariosResult {
  baselineCost: number;
  comparison: ScenarioComparison[];
  cheapestScenario: string;
  mostExpensiveScenario: string;
}

/**
 * Income tax bracket with description
 */
export interface TaxBracket {
  limit: number;
  rate: number;
  description: string;
}

/**
 * Result for default parameters
 */
export interface DefaultParamsResult {
  year: number;
  minWage: number;
  minWageNet: number;
  ssiLowerLimit: number;
  ssiUpperLimit: number;
  stampTaxRatio: number;
  incomeTaxBrackets: TaxBracket[];
}

// ============ Constants ============

/**
 * Default 2025 Turkish payroll parameters
 */
export const DEFAULT_PARAMS_2025: DefaultParamsResult = {
  year: 2025,
  minWage: 26005.5,
  minWageNet: 22104.67,
  ssiLowerLimit: 26005.5,
  ssiUpperLimit: 195041.4,
  stampTaxRatio: 0.00759,
  incomeTaxBrackets: [
    { limit: 158000, rate: 0.15, description: "158,000 TL'ye kadar %15" },
    { limit: 330000, rate: 0.2, description: "158,000-330,000 TL arası %20" },
    {
      limit: 1200000,
      rate: 0.27,
      description: "330,000-1,200,000 TL arası %27",
    },
    {
      limit: 4300000,
      rate: 0.35,
      description: "1,200,000-4,300,000 TL arası %35",
    },
    {
      limit: Number.MAX_SAFE_INTEGER,
      rate: 0.4,
      description: "4,300,000 TL'den fazlası %40",
    },
  ],
};
