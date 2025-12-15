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
} from "payrolla";
import type {
  CalculatePayrollInput,
  CalculatePayrollResult,
  CalculateBulkPayrollInput,
  CalculateBulkPayrollResult,
  PeriodResult,
  CustomParams,
} from "../types/index.js";

/**
 * Map string SSI type to enum
 */
function mapSSIType(ssiType?: string): SSIType {
  switch (ssiType) {
    case "S4B":
      return SSIType.S4B;
    case "S4C":
      return SSIType.S4C;
    case "S4A":
    default:
      return SSIType.S4A;
  }
}

/**
 * Map string calculation type to enum
 */
function mapCalculationType(calcType: string): CalculationType {
  return calcType === "Gross" ? CalculationType.Gross : CalculationType.Net;
}

/**
 * Map raw payment type values into Payrolla enum
 */
function mapPaymentType(paymentType?: number | string): PaymentType {
  switch (paymentType) {
    case 1:
    case "RegularPayment":
      return PaymentType.RegularPayment;
    case 2:
    case "Overtime":
      return PaymentType.Overtime;
    case 3:
    case "SocialAid":
      return PaymentType.SocialAid;
    case 4:
    case "ExtraPay":
    default:
      return PaymentType.ExtraPay;
  }
}

/**
 * Build custom global params for the payrolla client
 */
function buildCustomGlobalParams(customParams?: CustomParams) {
  if (!customParams) return undefined;

  return {
    minWage: customParams.minWage,
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
    cumulativeIncomeTaxBase = 0,
    cumulativeMinWageIncomeTaxBase = 0,
    transferredSSIBase1 = 0,
    transferredSSIBase2 = 0,
  } = input;

  // Build payments array
  const payments: PaymentItem[] = [
    {
      paymentAmount: undefined,
      paymentName: "Maas",
      paymentType: PaymentType.RegularPayment,
      paymentRef: "1",
    },
  ];

  // Add extra payments if any
  if (extraPayments && extraPayments.length > 0) {
    for (let i = 0; i < extraPayments.length; i++) {
      const extra = extraPayments[i];
      payments.push({
        paymentAmount: extra.amount,
        paymentName: extra.name,
        paymentType: mapPaymentType(extra.paymentType),
        paymentRef: `extra_${i + 2}`,
        calculationType:
          extra.type === "Net" ? CalculationType.Net : CalculationType.Gross,
      });
    }
  }

  const baseModel: Omit<
    WageCalculationModel,
    | "calcDate"
    | "cumulativeIncomeTaxBase"
    | "cumulativeMinWageIncomeTaxBase"
    | "transferredSSIBase1"
    | "transferredSSIBase2"
    | "periodCount"
  > = {
    wageAmount: wage,
    ssiType: mapSSIType(ssiType),
    wageCalculationType: mapCalculationType(calculationType),
    wagePeriodType: PaymentPeriodType.Monthly,
    periodLengthType: PeriodLengthType.Month,
    payments,
    calculationParams: {
      calculateMinWageExemption: true,
      customGlobalParams: buildCustomGlobalParams(customParams),
    },
  };

  let totalCost = 0;
  let totalNet = 0;
  let totalGross = 0;
  const periods: PeriodResult[] = [];

  let incomeTaxBase = cumulativeIncomeTaxBase;
  let minWageIncomeTaxBase = cumulativeMinWageIncomeTaxBase;
  let transferredBase1 = transferredSSIBase1;
  let transferredBase2 = transferredSSIBase2;

  for (let i = 0; i < periodCount; i++) {
    const calcDate = new Date(year, month - 1 + i, 1);
    const calcYear = calcDate.getFullYear();
    const calcMonth = calcDate.getMonth() + 1;

    const model: WageCalculationModel = {
      ...baseModel,
      calcDate: `${calcYear}-${String(calcMonth).padStart(2, "0")}-01`,
      cumulativeIncomeTaxBase: incomeTaxBase,
      cumulativeMinWageIncomeTaxBase: minWageIncomeTaxBase,
      transferredSSIBase1: transferredBase1,
      transferredSSIBase2: transferredBase2,
      periodCount: 1,
    };

    const result = await client.calculate(model);
    const payroll = result.payrolls?.[0];

    if (!payroll) {
      throw new Error("Payrolla calculation returned no payroll data");
    }

    const pr = payroll.payrollResult;
    totalCost += payroll.totalCost;
    totalNet += pr.totalNet;
    totalGross += pr.totalGross;

    const nextIncomeTaxBase = incomeTaxBase + pr.totalIncomeTaxBase;
    const nextMinWageIncomeTaxBase = pr.totalMinWageIncomeTaxExemptionBase;
    const nextTransferredBase1 = pr.transferredSSIBase1 ?? transferredBase1;
    const nextTransferredBase2 = pr.transferredSSIBase2 ?? transferredBase2;

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
      cumulativeIncomeTaxBase: nextIncomeTaxBase,
      cumulativeMinWageIncomeTaxBase: nextMinWageIncomeTaxBase,
      transferredSSIBase1: nextTransferredBase1,
      transferredSSIBase2: nextTransferredBase2,
    });

    incomeTaxBase = nextIncomeTaxBase;
    minWageIncomeTaxBase = nextMinWageIncomeTaxBase;
    transferredBase1 = nextTransferredBase1;
    transferredBase2 = nextTransferredBase2;
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
  const { employees, year, month, periodCount = 1, customParams } = input;

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
      cumulativeIncomeTaxBase: emp.cumulativeIncomeTaxBase,
      cumulativeMinWageIncomeTaxBase: emp.cumulativeMinWageIncomeTaxBase,
      transferredSSIBase1: emp.transferredSSIBase1,
      transferredSSIBase2: emp.transferredSSIBase2,
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
