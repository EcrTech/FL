import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";

export interface EMIRecord {
  id: string;
  emi_number: number;
  principal_amount: number;
  interest_amount: number;
  total_emi: number;
  due_date: string;
  status: string;
  payment_date: string | null;
  amount_paid: number | null;
}

export interface PaymentRecord {
  id: string;
  payment_amount: number;
  payment_date: string;
  payment_mode: string;
  reference_number: string | null;
  status: string;
}

export interface LoanApplicationSummary {
  applicationId: string;
  loanId: string | null;
  applicationNumber: string;
  status: string;
  currentStage: string;
  requestedAmount: number;
  approvedAmount: number | null;
  disbursedAmount: number | null;
  tenureDays: number;
  createdAt: string;
  sanctionDate: string | null;
  disbursementDate: string | null;
  emiSchedule: EMIRecord[];
  payments: PaymentRecord[];
  totalPaid: number;
  totalOutstanding: number;
}

export interface CustomerDocument {
  id: string;
  documentType: string;
  documentCategory: string;
  filePath: string;
  fileName: string;
  verificationStatus: string;
}

export interface CustomerRelationship {
  customerId: string;
  panNumber: string;
  aadhaarNumber: string;
  mobile: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  totalLoans: number;
  activeLoans: number;
  totalDisbursed: number;
  totalPaid: number;
  outstandingAmount: number;
  paymentScore: 'excellent' | 'good' | 'fair' | 'poor';
  lastApplicationDate: string;
  applications: LoanApplicationSummary[];
  documents: CustomerDocument[];
}

interface CustomerGroup {
  pan_number: string;
  mobile: string;
  first_name: string;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  aadhaar_number: string | null;
}

function calculatePaymentScore(applications: LoanApplicationSummary[]): 'excellent' | 'good' | 'fair' | 'poor' {
  let totalEmis = 0;
  let paidOnTime = 0;
  let paidLate = 0;
  let overdue = 0;

  applications.forEach(app => {
    app.emiSchedule.forEach(emi => {
      totalEmis++;
      if (emi.status === 'paid') {
        if (emi.payment_date && new Date(emi.payment_date) <= new Date(emi.due_date)) {
          paidOnTime++;
        } else {
          paidLate++;
        }
      } else if (emi.status === 'overdue') {
        overdue++;
      }
    });
  });

  if (totalEmis === 0) return 'good'; // No history yet

  const onTimeRatio = paidOnTime / totalEmis;
  const overdueRatio = overdue / totalEmis;

  if (overdueRatio > 0.2) return 'poor';
  if (overdueRatio > 0.1 || paidLate / totalEmis > 0.3) return 'fair';
  if (onTimeRatio > 0.9) return 'excellent';
  return 'good';
}

function maskAadhaar(aadhaar: string | null): string {
  if (!aadhaar) return 'N/A';
  return 'XXXX-XXXX-' + aadhaar.slice(-4);
}

export function useCustomerRelationships(searchTerm?: string) {
  const { orgId } = useOrgContext();

  return useQuery({
    queryKey: ["customer-relationships", orgId, searchTerm],
    queryFn: async (): Promise<CustomerRelationship[]> => {
      if (!orgId) return [];

      // Step 1: Get all unique customers (grouped by PAN or mobile)
      const { data: applicants, error: applicantsError } = await supabase
        .from("loan_applicants")
        .select(`
          id,
          pan_number,
          mobile,
          first_name,
          middle_name,
          last_name,
          email,
          aadhaar_number,
          loan_application_id,
          loan_applications!inner (
            id,
            org_id,
            loan_id,
            application_number,
            status,
            current_stage,
            requested_amount,
            approved_amount,
            tenure_days,
            created_at
          )
        `)
        .eq("loan_applications.org_id", orgId)
        .eq("applicant_type", "primary");

      if (applicantsError) throw applicantsError;

      // Group applicants by PAN number (primary identifier) or mobile
      const customerMap = new Map<string, {
        info: CustomerGroup;
        applicationIds: string[];
      }>();

      applicants?.forEach((applicant: any) => {
        const key = applicant.pan_number || applicant.mobile;
        if (!key) return;

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            info: {
              pan_number: applicant.pan_number,
              mobile: applicant.mobile,
              first_name: applicant.first_name,
              middle_name: applicant.middle_name,
              last_name: applicant.last_name,
              email: applicant.email,
              aadhaar_number: applicant.aadhaar_number,
            },
            applicationIds: [],
          });
        }

        customerMap.get(key)!.applicationIds.push(applicant.loan_application_id);
      });

      // Filter by search term if provided
      let filteredCustomers = Array.from(customerMap.entries());
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredCustomers = filteredCustomers.filter(([_, customer]) => {
          const fullName = `${customer.info.first_name} ${customer.info.middle_name || ''} ${customer.info.last_name || ''}`.toLowerCase();
          return (
            customer.info.pan_number?.toLowerCase().includes(search) ||
            customer.info.mobile?.includes(search) ||
            fullName.includes(search)
          );
        });
      }

      // Fetch customer_id from contacts for all customers by phone
      const allMobiles = Array.from(customerMap.values())
        .map(c => c.info.mobile)
        .filter(Boolean);
      
      const contactCustomerIdMap = new Map<string, string>();
      if (allMobiles.length > 0) {
        const { data: contactsData } = await supabase
          .from("contacts")
          .select("phone, customer_id")
          .in("phone", allMobiles)
          .not("customer_id", "is", null);
        
        contactsData?.forEach((c: any) => {
          if (c.customer_id) {
            contactCustomerIdMap.set(c.phone, c.customer_id);
          }
        });
      }

      // Step 2: For each customer, fetch detailed application data
      const relationships: CustomerRelationship[] = [];

      for (const [_, customer] of filteredCustomers) {
        const applicationIds = customer.applicationIds;

        // Fetch applications with all related data
        const { data: applications, error: appsError } = await supabase
          .from("loan_applications")
          .select(`
            id,
            loan_id,
            application_number,
            status,
            current_stage,
            requested_amount,
            approved_amount,
            tenure_days,
            created_at,
            
            loan_sanctions (
              id,
              sanctioned_amount,
              created_at
            ),
            loan_disbursements (
              id,
              disbursement_amount,
              disbursement_date
            ),
            loan_repayment_schedule (
              id,
              emi_number,
              principal_amount,
              interest_amount,
              total_emi,
              due_date,
              status,
              payment_date,
              amount_paid
            ),
            loan_payments (
              id,
              payment_amount,
              payment_date,
              payment_method,
              transaction_reference
            ),
            loan_documents (
              id,
              document_type,
              document_category,
              file_path,
              file_name,
              verification_status
            )
          `)
          .in("id", applicationIds)
          .order("created_at", { ascending: false });

        if (appsError) throw appsError;

        // Collect all documents from all applications
        const allDocuments: CustomerDocument[] = [];
        let photoUrl: string | null = null;

        const appSummaries: LoanApplicationSummary[] = (applications || []).map((app: any) => {
          const emiSchedule: EMIRecord[] = (app.loan_repayment_schedule || []).map((emi: any) => ({
            id: emi.id,
            emi_number: emi.emi_number,
            principal_amount: emi.principal_amount,
            interest_amount: emi.interest_amount,
            total_emi: emi.total_emi,
            due_date: emi.due_date,
            status: emi.status,
            payment_date: emi.payment_date,
            amount_paid: emi.amount_paid,
          }));

          const payments: PaymentRecord[] = (app.loan_payments || []).map((p: any) => ({
            id: p.id,
            payment_amount: p.payment_amount,
            payment_date: p.payment_date,
            payment_mode: p.payment_method || 'unknown',
            reference_number: p.transaction_reference,
            status: 'completed',
          }));

          // Collect documents
          (app.loan_documents || []).forEach((doc: any) => {
            // Check if this is a photo document
            if (doc.document_type?.toLowerCase().includes('photo') || 
                doc.document_category?.toLowerCase().includes('photo')) {
              if (!photoUrl && doc.file_path) {
                photoUrl = doc.file_path;
              }
            }
            
            // Add to documents collection if not already present
            if (!allDocuments.find(d => d.id === doc.id)) {
              allDocuments.push({
                id: doc.id,
                documentType: doc.document_type,
                documentCategory: doc.document_category,
                filePath: doc.file_path,
                fileName: doc.file_name,
                verificationStatus: doc.verification_status,
              });
            }
          });

          const disbursement = app.loan_disbursements?.[0];
          const sanction = app.loan_sanctions?.[0];

          const totalPaid = payments
            .filter((p: PaymentRecord) => p.status === 'completed')
            .reduce((sum: number, p: PaymentRecord) => sum + p.payment_amount, 0);

          const totalDue = emiSchedule.reduce((sum: number, e: EMIRecord) => sum + e.total_emi, 0);
          const totalOutstanding = Math.max(0, totalDue - totalPaid);

          return {
            applicationId: app.id,
            loanId: app.loan_id,
            applicationNumber: app.application_number,
            status: app.status,
            currentStage: app.current_stage,
            requestedAmount: app.requested_amount,
            approvedAmount: app.approved_amount || sanction?.sanctioned_amount,
            disbursedAmount: disbursement?.disbursement_amount,
            tenureDays: app.tenure_days,
            createdAt: app.created_at,
            sanctionDate: sanction?.created_at,
            disbursementDate: disbursement?.disbursement_date,
            emiSchedule,
            payments,
            totalPaid,
            totalOutstanding,
          };
        });

        const totalDisbursed = appSummaries.reduce((sum, app) => sum + (app.disbursedAmount || 0), 0);
        const totalPaid = appSummaries.reduce((sum, app) => sum + app.totalPaid, 0);
        const totalOutstanding = appSummaries.reduce((sum, app) => sum + app.totalOutstanding, 0);
        const activeLoans = appSummaries.filter(app => 
          app.currentStage === 'disbursed' && app.totalOutstanding > 0
        ).length;

        const fullName = [customer.info.first_name, customer.info.middle_name, customer.info.last_name]
          .filter(Boolean)
          .join(' ');

        relationships.push({
          customerId: contactCustomerIdMap.get(customer.info.mobile) || customer.info.pan_number || customer.info.mobile,
          panNumber: customer.info.pan_number || 'N/A',
          aadhaarNumber: maskAadhaar(customer.info.aadhaar_number),
          mobile: customer.info.mobile || 'N/A',
          name: fullName,
          email: customer.info.email,
          photoUrl,
          totalLoans: appSummaries.length,
          activeLoans,
          totalDisbursed,
          totalPaid,
          outstandingAmount: totalOutstanding,
          paymentScore: calculatePaymentScore(appSummaries),
          lastApplicationDate: appSummaries[0]?.createdAt || '',
          applications: appSummaries,
          documents: allDocuments,
        });
      }

      // Only include customers who have at least one disbursed loan (business rule: client = disbursed)
      const clients = relationships.filter(r => 
        r.applications.some(a => a.currentStage === 'disbursed')
      );

      // Sort by last application date descending
      clients.sort((a, b) => 
        new Date(b.lastApplicationDate).getTime() - new Date(a.lastApplicationDate).getTime()
      );

      return clients;
    },
    enabled: !!orgId,
  });
}
