/**
 * Shared loan calculation utility - Single Source of Truth
 * All loan interest/repayment calculations should use this utility
 */

export interface LoanCalculationResult {
  totalInterest: number;
  totalRepayment: number;
}

/**
 * Calculate loan details based on principal, daily interest rate, and tenure
 * @param principal - Loan principal amount
 * @param dailyInterestRate - Daily interest rate in percentage (e.g., 1 for 1%)
 * @param tenureDays - Loan tenure in days
 * @returns Calculated total interest, total repayment, and daily EMI
 */
export function calculateLoanDetails(
  principal: number,
  dailyInterestRate: number,
  tenureDays: number
): LoanCalculationResult {
  const totalInterest = principal * (dailyInterestRate / 100) * tenureDays;
  const totalRepayment = principal + totalInterest;

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
  };
}

/**
 * Format currency in INR format
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
