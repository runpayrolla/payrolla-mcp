/**
 * Payroll calculation tools for MCP server
 */

import {
  PayrollaClient,
  SSIType,
  CalculationType,
  PaymentPeriodType,
  PeriodLengthType,
  PaymentType,
  type WageCalculationModel,
  type PaymentItem,
} from 'payrolla';
import type {
  CalculatePayrollInput,
  CalculatePayrollResult,
  CalculateBulkPayrollInput,
  CalculateBulkPayrollResult,
  PeriodResult,
  CustomParams,
} from '../types/index.js';

/**
 * Map string SSI type to enum
 */
function mapSSIType(ssiType?: string): SSIType {
  switch (ssiType) {
    case 'S4B':
      return SSIType.S4B;
    case 'S4C':
      return SSIType.S4C;
    case 'S4A':
    default:
      return SSIType.S4A;
  }
}

/**
 * Map string calculation type to enum
 */
function mapCalculationType(calcType: string): CalculationType {
  return calcType === 'Gross' ? CalculationType.Gross : CalculationType.Net;
}

/**
 * Build custom global params for the payrolla client
 */
function buildCustomGlobalParams(customParams?: CustomParams) {
  if (!customParams) return undefined;

  return {
    minWage: customParams.minWage,
    minWageNet: customParams.minWageNet,
    ssi_LowerLimit: customParams.ssiLowerLimit,
    ssi_UpperLimit: customParams.ssiUpperLimit,
    stampTaxRatio: customParams.stampTaxRatio,
    incomeTaxLimits: customParams.incomeTaxLimits,
  };
}

/**
 * Calculate payroll for a single employee
 */
export async function calculatePayroll(
  client: PayrollaClient,
  input: CalculatePayrollInput
): Promise<CalculatePayrollResult> {
  const {
    name,
    wage,
    calculationType,
    ssiType,
    year,
    month,
    periodCount = 1,
    extraPayments,
    customParams,
  } = input;

  // Build payments array
  const payments: PaymentItem[] = [
    {
      paymentAmount: 31,
      paymentName: 'Maas',
      paymentType: PaymentType.RegularPayment,
      paymentRef: '1',
    },
  ];

  // Add extra payments if any
  if (extraPayments && extraPayments.length > 0) {
    for (let i = 0; i < extraPayments.length; i++) {
      const extra = extraPayments[i];
      payments.push({
        paymentAmount: extra.amount,
        paymentName: extra.name,
        paymentType: PaymentType.ExtraPay,
        paymentRef: `extra_${i + 2}`,
        calculationType: extra.type === 'Net' ? CalculationType.Net : CalculationType.Gross,
      });
    }
  }

  // Build the model directly for full control
  const model: WageCalculationModel = {
    calcDate: `${year}-${String(month).padStart(2, '0')}-01`,
    wageAmount: wage,
    cumulativeIncomeTaxBase: 0,
    cumulativeMinWageIncomeTaxBase: 0,
    ssiType: mapSSIType(ssiType),
    wageCalculationType: mapCalculationType(calculationType),
    wagePeriodType: PaymentPeriodType.Monthly,
    periodCount,
    periodLengthType: PeriodLengthType.Month,
    payments,
    calculationParams: {
      calculateMinWageExemption: true,
      customGlobalParams: buildCustomGlobalParams(customParams),
    },
  };

  // Execute calculation
  const result = await client.calculate(model);

  // Transform result
  let totalCost = 0;
  let totalNet = 0;
  let totalGross = 0;
  const periods: PeriodResult[] = [];

  for (const payroll of result.payrolls) {
    const pr = payroll.payrollResult;
    totalCost += payroll.totalCost;
    totalNet += pr.totalNet;
    totalGross += pr.totalGross;

    periods.push({
      year: payroll.year,
      month: payroll.month,
      grossWage: pr.totalGross,
      netWage: pr.totalNet,
      employerCost: payroll.totalCost,
      incomeTax: pr.totalIncomeTax,
      stampTax: pr.totalStampTax,
      employeeSSI: pr.totalSSIWorkerPrem,
      employerSSI: pr.totalSSIEmployerPrem,
    });
  }

  return {
    employee: name,
    totalCost,
    totalNet,
    totalGross,
    periods,
  };
}

/**
 * Calculate payroll for multiple employees with shared parameters
 */
export async function calculateBulkPayroll(
  client: PayrollaClient,
  input: CalculateBulkPayrollInput
): Promise<CalculateBulkPayrollResult> {
  const {
    employees,
    year,
    month,
    periodCount = 1,
    customParams,
  } = input;

  const employeeResults: Array<{
    name: string;
    totalCost: number;
    totalNet: number;
    totalGross: number;
  }> = [];

  let totalYearlyCost = 0;
  let totalYearlyNet = 0;
  let totalYearlyGross = 0;

  // Calculate for each employee
  for (const emp of employees) {
    const result = await calculatePayroll(client, {
      name: emp.name,
      wage: emp.wage,
      calculationType: emp.calculationType,
      ssiType: emp.ssiType,
      year,
      month,
      periodCount,
      extraPayments: emp.extraPayments,
      customParams,
    });

    employeeResults.push({
      name: result.employee,
      totalCost: result.totalCost,
      totalNet: result.totalNet,
      totalGross: result.totalGross,
    });

    totalYearlyCost += result.totalCost;
    totalYearlyNet += result.totalNet;
    totalYearlyGross += result.totalGross;
  }

  return {
    summary: {
      totalEmployees: employees.length,
      totalYearlyCost,
      totalYearlyNet,
      totalYearlyGross,
      averageMonthlyCost: totalYearlyCost / periodCount,
    },
    employees: employeeResults,
  };
}
