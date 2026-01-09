import { useAuth } from "@/contexts/AuthContext";

export type LOSRole = "credit_manager" | "credit_officer" | "disbursement_officer" | "admin";

export interface LOSPermissions {
  canCreateApplication: boolean;
  canViewApplications: boolean;
  canEditApplication: boolean;
  canDeleteApplication: boolean;
  canUploadDocuments: boolean;
  canPerformVerification: boolean;
  canAssessEligibility: boolean;
  canApproveLoans: boolean;
  canRejectLoans: boolean;
  canGenerateSanction: boolean;
  canInitiateDisbursement: boolean;
  canUpdateDisbursementStatus: boolean;
  canViewReports: boolean;
}

const rolePermissions: Record<LOSRole, LOSPermissions> = {
  admin: {
    canCreateApplication: true,
    canViewApplications: true,
    canEditApplication: true,
    canDeleteApplication: true,
    canUploadDocuments: true,
    canPerformVerification: true,
    canAssessEligibility: true,
    canApproveLoans: true,
    canRejectLoans: true,
    canGenerateSanction: true,
    canInitiateDisbursement: true,
    canUpdateDisbursementStatus: true,
    canViewReports: true,
  },
  credit_manager: {
    canCreateApplication: true,
    canViewApplications: true,
    canEditApplication: true,
    canDeleteApplication: false,
    canUploadDocuments: true,
    canPerformVerification: true,
    canAssessEligibility: true,
    canApproveLoans: true,
    canRejectLoans: true,
    canGenerateSanction: true,
    canInitiateDisbursement: false,
    canUpdateDisbursementStatus: false,
    canViewReports: true,
  },
  credit_officer: {
    canCreateApplication: true,
    canViewApplications: true,
    canEditApplication: true,
    canDeleteApplication: false,
    canUploadDocuments: true,
    canPerformVerification: true,
    canAssessEligibility: true,
    canApproveLoans: false,
    canRejectLoans: false,
    canGenerateSanction: false,
    canInitiateDisbursement: false,
    canUpdateDisbursementStatus: false,
    canViewReports: true,
  },
  disbursement_officer: {
    canCreateApplication: false,
    canViewApplications: true,
    canEditApplication: false,
    canDeleteApplication: false,
    canUploadDocuments: false,
    canPerformVerification: false,
    canAssessEligibility: false,
    canApproveLoans: false,
    canRejectLoans: false,
    canGenerateSanction: false,
    canInitiateDisbursement: true,
    canUpdateDisbursementStatus: true,
    canViewReports: true,
  },
};

/**
 * LOS Permissions hook that uses centralized AuthContext
 * Prevents duplicate auth API calls
 */
export function useLOSPermissions() {
  const { userRole, isLoading } = useAuth();

  // Map the general role to LOS role
  const losRole: LOSRole | null = userRole === "admin" || userRole === "super_admin" 
    ? "admin" 
    : userRole 
      ? "credit_officer" 
      : null;

  const permissions: LOSPermissions = losRole 
    ? rolePermissions[losRole]
    : {
        canCreateApplication: false,
        canViewApplications: false,
        canEditApplication: false,
        canDeleteApplication: false,
        canUploadDocuments: false,
        canPerformVerification: false,
        canAssessEligibility: false,
        canApproveLoans: false,
        canRejectLoans: false,
        canGenerateSanction: false,
        canInitiateDisbursement: false,
        canUpdateDisbursementStatus: false,
        canViewReports: false,
      };

  return {
    permissions,
    userRole: losRole,
    isLoading,
  };
}
