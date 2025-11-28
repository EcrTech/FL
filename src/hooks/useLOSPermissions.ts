import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function useLOSPermissions() {
  const { data: userRole, isLoading } = useQuery({
    queryKey: ["los-user-role"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || roles.length === 0) return null;

      // Check for admin first
      if (roles.some(r => r.role === "admin")) return "admin";
      
      // For LOS, we'll use a custom role check
      // In production, you'd have a separate LOS roles table
      // For now, we'll treat all non-admin users as credit_officer
      return "credit_officer" as LOSRole;
    },
  });

  const permissions: LOSPermissions = userRole 
    ? rolePermissions[userRole]
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
    userRole,
    isLoading,
  };
}
