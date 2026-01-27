import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// State code mapping for Equifax API
const STATE_CODES: Record<string, string> = {
  "andhra pradesh": "AP",
  "arunachal pradesh": "AR",
  "assam": "AS",
  "bihar": "BR",
  "chhattisgarh": "CG",
  "goa": "GA",
  "gujarat": "GJ",
  "haryana": "HR",
  "himachal pradesh": "HP",
  "jharkhand": "JH",
  "karnataka": "KA",
  "kerala": "KL",
  "madhya pradesh": "MP",
  "maharashtra": "MH",
  "manipur": "MN",
  "meghalaya": "ML",
  "mizoram": "MZ",
  "nagaland": "NL",
  "odisha": "OD",
  "orissa": "OD",
  "punjab": "PB",
  "rajasthan": "RJ",
  "sikkim": "SK",
  "tamil nadu": "TN",
  "tamilnadu": "TN",
  "telangana": "TS",
  "tripura": "TR",
  "uttar pradesh": "UP",
  "uttarakhand": "UK",
  "west bengal": "WB",
  "andaman and nicobar islands": "AN",
  "chandigarh": "CH",
  "dadra and nagar haveli": "DN",
  "daman and diu": "DD",
  "delhi": "DL",
  "new delhi": "DL",
  "jammu and kashmir": "JK",
  "ladakh": "LA",
  "lakshadweep": "LD",
  "puducherry": "PY",
  "pondicherry": "PY",
};

// Hit code descriptions
const HIT_CODES: Record<string, string> = {
  "01": "Hit - Records found",
  "02": "No Hit - No records found",
  "03": "ACGI - Age Criteria Not Met",
  "04": "ID Scrub Failed",
  "05": "File Frozen",
  "06": "System Error",
};

// Payment status codes interpretation
const PAYMENT_STATUS: Record<string, { label: string; severity: "current" | "dpd" | "severe" | "writeoff" }> = {
  "000": { label: "Current", severity: "current" },
  "STD": { label: "Standard", severity: "current" },
  "XXX": { label: "Not Reported", severity: "current" },
  "NEW": { label: "New Account", severity: "current" },
  "SMA": { label: "Special Mention Account", severity: "dpd" },
  "SUB": { label: "Sub-Standard", severity: "severe" },
  "DBT": { label: "Doubtful", severity: "severe" },
  "LSS": { label: "Loss", severity: "writeoff" },
  "WOF": { label: "Written Off", severity: "writeoff" },
};

function getStateCode(state: string): string {
  if (!state) return "";
  const normalized = state.toLowerCase().trim();
  
  // Check if already a 2-letter code
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }
  
  return STATE_CODES[normalized] || state.substring(0, 2).toUpperCase();
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Convert YYYY-MM-DD to DD-MM-YYYY
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

function parseDPDFromPaymentHistory(history: string): number {
  if (!history) return 0;
  
  // Parse DPD values like "030", "060", "090"
  const dpdMatch = history.match(/(\d{3})/);
  if (dpdMatch) {
    const dpd = parseInt(dpdMatch[1], 10);
    return dpd;
  }
  return 0;
}

function parseEquifaxResponse(response: any): any {
  try {
    const inquiryResponse = response?.INProfileResponse?.CIRReportDataLst?.[0] || {};
    const cirReportData = inquiryResponse.CIRReportData || {};
    const header = cirReportData.Header || {};
    const scoreDetails = cirReportData.ScoreDetails?.[0] || {};
    const retailAccountsSummary = cirReportData.RetailAccountsSummary || {};
    const retailAccountDetails = cirReportData.RetailAccountDetails || [];
    const enquirySummary = cirReportData.EnquirySummary || {};
    const enquiries = cirReportData.Enquiries || [];
    const idAndContactInfo = cirReportData.IDAndContactInfo || {};
    const personalInfo = idAndContactInfo.PersonalInfo || {};

    // Extract personal details
    const name = personalInfo.Name || {};
    const fullName = [name.FirstName, name.MiddleName, name.LastName]
      .filter(Boolean)
      .join(" ");

    // Parse accounts
    const accounts = retailAccountDetails.map((acc: any) => {
      const history48Months = acc.History48Months || "";
      const paymentHistory = [];
      
      // Parse payment history - each 3 characters represents a month
      for (let i = 0; i < history48Months.length && i < 144; i += 3) {
        const status = history48Months.substring(i, i + 3);
        const monthIndex = Math.floor(i / 3);
        paymentHistory.push({
          month: monthIndex + 1,
          status: status,
          label: PAYMENT_STATUS[status]?.label || status,
          severity: PAYMENT_STATUS[status]?.severity || "current",
        });
      }

      return {
        institution: acc.Institution || "Unknown",
        accountType: acc.AccountType || "Unknown",
        ownershipType: acc.OwnershipType || "Individual",
        accountNumber: acc.AccountNumber || "",
        status: acc.AccountStatus || "Unknown",
        sanctionAmount: parseFloat(acc.SanctionAmount) || 0,
        currentBalance: parseFloat(acc.CurrentBalance) || 0,
        pastDueAmount: parseFloat(acc.AmountPastDue) || 0,
        emiAmount: parseFloat(acc.InstallmentAmount) || 0,
        dateOpened: acc.DateOpened || "",
        dateClosed: acc.DateClosed || "",
        dateReported: acc.DateReported || "",
        paymentHistory: paymentHistory,
        rawHistory: history48Months,
      };
    });

    // Calculate summary from accounts
    const activeAccounts = accounts.filter((a: any) => 
      !["Closed", "CLOSED", "Written Off"].includes(a.status)
    );
    const closedAccounts = accounts.filter((a: any) => 
      ["Closed", "CLOSED"].includes(a.status)
    );
    const writeOffAccounts = accounts.filter((a: any) => 
      a.status === "Written Off" || a.status === "WOF"
    );

    // Parse enquiries
    const parsedEnquiries = enquiries.map((enq: any) => ({
      date: enq.Date || "",
      institution: enq.Institution || "",
      purpose: enq.Purpose || "",
      amount: parseFloat(enq.Amount) || 0,
    }));

    // Count enquiries by time period
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const enquiries30Days = parsedEnquiries.filter((e: any) => {
      const date = new Date(e.date);
      return date >= thirtyDaysAgo;
    }).length;

    const enquiries90Days = parsedEnquiries.filter((e: any) => {
      const date = new Date(e.date);
      return date >= ninetyDaysAgo;
    }).length;

    return {
      reportOrderNo: header.ReportOrderNO || "",
      reportDate: header.ReportDate || new Date().toISOString(),
      creditScore: parseInt(scoreDetails.Score) || 0,
      scoreType: scoreDetails.Type || "ERS",
      scoreVersion: scoreDetails.Version || "4.0",
      hitCode: header.HitCode || "01",
      hitDescription: HIT_CODES[header.HitCode] || "Unknown",
      summary: {
        totalAccounts: accounts.length,
        activeAccounts: activeAccounts.length,
        closedAccounts: closedAccounts.length,
        writeOffAccounts: writeOffAccounts.length,
        totalOutstanding: parseFloat(retailAccountsSummary.TotalBalanceAmount) || 
          accounts.reduce((sum: number, a: any) => sum + a.currentBalance, 0),
        totalPastDue: parseFloat(retailAccountsSummary.TotalPastDue) || 
          accounts.reduce((sum: number, a: any) => sum + a.pastDueAmount, 0),
        totalSanctioned: parseFloat(retailAccountsSummary.TotalSanctionAmount) || 
          accounts.reduce((sum: number, a: any) => sum + a.sanctionAmount, 0),
        oldestAccountDate: retailAccountsSummary.OldestAccount || "",
        recentAccountDate: retailAccountsSummary.RecentAccount || "",
        totalCreditLimit: parseFloat(retailAccountsSummary.TotalCreditLimit) || 0,
        totalMonthlyPayment: parseFloat(retailAccountsSummary.TotalMonthlyPaymentAmount) || 0,
      },
      accounts: accounts,
      enquiries: {
        total30Days: enquiries30Days,
        total90Days: enquiries90Days,
        totalAll: parsedEnquiries.length,
        list: parsedEnquiries,
      },
      personalInfo: {
        name: fullName,
        dob: personalInfo.DateOfBirth || "",
        pan: idAndContactInfo.PANId?.[0]?.IdNumber || "",
        gender: personalInfo.Gender || "",
        addresses: (idAndContactInfo.AddressInfo || []).map((addr: any) => 
          [addr.Address, addr.City, addr.State, addr.Postal].filter(Boolean).join(", ")
        ),
        phones: (idAndContactInfo.PhoneInfo || []).map((phone: any) => phone.Number),
      },
    };
  } catch (error) {
    console.error("Error parsing Equifax response:", error);
    throw new Error("Failed to parse credit report response");
  }
}

function generateMockResponse(applicantData: any): any {
  // Generate realistic mock data for testing
  const mockScore = 650 + Math.floor(Math.random() * 200);
  
  return {
    reportOrderNo: `EQ${Date.now()}`,
    reportDate: new Date().toISOString(),
    creditScore: mockScore,
    scoreType: "ERS",
    scoreVersion: "4.0",
    hitCode: "01",
    hitDescription: "Hit - Records found",
    summary: {
      totalAccounts: 6,
      activeAccounts: 4,
      closedAccounts: 2,
      writeOffAccounts: 0,
      totalOutstanding: 309395,
      totalPastDue: 2003,
      totalSanctioned: 1179000,
      oldestAccountDate: "2018-03-15",
      recentAccountDate: "2024-11-20",
      totalCreditLimit: 250000,
      totalMonthlyPayment: 15540,
    },
    accounts: [
      {
        institution: "Sundaram Finance Ltd",
        accountType: "Auto Loan",
        ownershipType: "Individual",
        accountNumber: "XXXXXXXXX1234",
        status: "Current",
        sanctionAmount: 450000,
        currentBalance: 155105,
        pastDueAmount: 0,
        emiAmount: 5540,
        dateOpened: "2021-07-06",
        dateClosed: "",
        dateReported: "2025-05-15",
        paymentHistory: Array.from({ length: 24 }, (_, i) => ({
          month: i + 1,
          status: "000",
          label: "Current",
          severity: "current",
        })),
        rawHistory: "000".repeat(24),
      },
      {
        institution: "HDFC Bank",
        accountType: "Credit Card",
        ownershipType: "Individual",
        accountNumber: "XXXXXXXXX5678",
        status: "Current",
        sanctionAmount: 100000,
        currentBalance: 45000,
        pastDueAmount: 2003,
        emiAmount: 0,
        dateOpened: "2019-04-12",
        dateClosed: "",
        dateReported: "2025-05-15",
        paymentHistory: Array.from({ length: 24 }, (_, i) => ({
          month: i + 1,
          status: i === 0 ? "030" : "000",
          label: i === 0 ? "30 DPD" : "Current",
          severity: i === 0 ? "dpd" : "current",
        })),
        rawHistory: "030" + "000".repeat(23),
      },
      {
        institution: "State Bank of India",
        accountType: "Personal Loan",
        ownershipType: "Individual",
        accountNumber: "XXXXXXXXX9012",
        status: "Current",
        sanctionAmount: 300000,
        currentBalance: 89290,
        pastDueAmount: 0,
        emiAmount: 7500,
        dateOpened: "2022-01-20",
        dateClosed: "",
        dateReported: "2025-05-15",
        paymentHistory: Array.from({ length: 24 }, (_, i) => ({
          month: i + 1,
          status: "000",
          label: "Current",
          severity: "current",
        })),
        rawHistory: "000".repeat(24),
      },
      {
        institution: "Bajaj Finance",
        accountType: "Consumer Loan",
        ownershipType: "Individual",
        accountNumber: "XXXXXXXXX3456",
        status: "Current",
        sanctionAmount: 80000,
        currentBalance: 20000,
        pastDueAmount: 0,
        emiAmount: 2500,
        dateOpened: "2024-03-10",
        dateClosed: "",
        dateReported: "2025-05-15",
        paymentHistory: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          status: "000",
          label: "Current",
          severity: "current",
        })),
        rawHistory: "000".repeat(12),
      },
      {
        institution: "ICICI Bank",
        accountType: "Home Loan",
        ownershipType: "Joint",
        accountNumber: "XXXXXXXXX7890",
        status: "Closed",
        sanctionAmount: 2500000,
        currentBalance: 0,
        pastDueAmount: 0,
        emiAmount: 0,
        dateOpened: "2015-06-15",
        dateClosed: "2023-06-15",
        dateReported: "2023-07-01",
        paymentHistory: Array.from({ length: 48 }, (_, i) => ({
          month: i + 1,
          status: "000",
          label: "Current",
          severity: "current",
        })),
        rawHistory: "000".repeat(48),
      },
      {
        institution: "Axis Bank",
        accountType: "Credit Card",
        ownershipType: "Individual",
        accountNumber: "XXXXXXXXX1357",
        status: "Closed",
        sanctionAmount: 50000,
        currentBalance: 0,
        pastDueAmount: 0,
        emiAmount: 0,
        dateOpened: "2018-09-01",
        dateClosed: "2022-12-15",
        dateReported: "2023-01-01",
        paymentHistory: Array.from({ length: 48 }, (_, i) => ({
          month: i + 1,
          status: "000",
          label: "Current",
          severity: "current",
        })),
        rawHistory: "000".repeat(48),
      },
    ],
    enquiries: {
      total30Days: 1,
      total90Days: 3,
      totalAll: 5,
      list: [
        { date: "2025-05-20", institution: "HDFC Bank", purpose: "Personal Loan", amount: 100000 },
        { date: "2025-04-15", institution: "Bajaj Finance", purpose: "Consumer Loan", amount: 50000 },
        { date: "2025-03-10", institution: "ICICI Bank", purpose: "Credit Card", amount: 0 },
        { date: "2024-12-05", institution: "SBI", purpose: "Home Loan", amount: 3000000 },
        { date: "2024-09-20", institution: "Kotak Mahindra", purpose: "Auto Loan", amount: 500000 },
      ],
    },
    personalInfo: {
      name: applicantData.firstName + " " + (applicantData.lastName || ""),
      dob: applicantData.dob || "",
      pan: applicantData.panNumber || "",
      gender: applicantData.gender || "",
      addresses: [applicantData.address?.line1 + ", " + applicantData.address?.city + ", " + applicantData.address?.state],
      phones: [applicantData.mobile],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { applicantId, applicationId, orgId } = body;

    if (!applicantId || !applicationId || !orgId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: applicantId, applicationId, orgId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch applicant data from database
    const { data: applicant, error: applicantError } = await supabase
      .from("loan_applicants")
      .select("*")
      .eq("id", applicantId)
      .single();

    if (applicantError || !applicant) {
      return new Response(
        JSON.stringify({ success: false, error: "Applicant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare applicant data for API call
    const applicantData = {
      firstName: applicant.first_name || "",
      middleName: applicant.middle_name || "",
      lastName: applicant.last_name || "",
      dob: applicant.date_of_birth || "",
      panNumber: applicant.pan_number || "",
      aadhaarNumber: applicant.aadhaar_number || "",
      mobile: applicant.mobile || "",
      gender: applicant.gender || "",
      address: {
        line1: applicant.address_line1 || applicant.current_address || "",
        city: applicant.city || "",
        state: applicant.state || "",
        postal: applicant.pincode || applicant.postal_code || "",
      },
    };

    // Get Equifax credentials
    const customerId = Deno.env.get("EQUIFAX_CUSTOMER_ID");
    const userId = Deno.env.get("EQUIFAX_USER_ID");
    const password = Deno.env.get("EQUIFAX_PASSWORD");
    const memberNumber = Deno.env.get("EQUIFAX_MEMBER_NUMBER");
    const securityCode = Deno.env.get("EQUIFAX_SECURITY_CODE");
    const apiUrl = Deno.env.get("EQUIFAX_API_URL");

    // Debug logging for credentials check
    console.log("[EQUIFAX-DEBUG] ========== CREDENTIAL CHECK ==========");
    console.log("[EQUIFAX-DEBUG] Credential check:", {
      hasCustomerId: !!customerId,
      customerIdLength: customerId?.length || 0,
      hasUserId: !!userId,
      userIdLength: userId?.length || 0,
      hasPassword: !!password,
      passwordLength: password?.length || 0,
      hasMemberNumber: !!memberNumber,
      memberNumberLength: memberNumber?.length || 0,
      hasSecurityCode: !!securityCode,
      securityCodeLength: securityCode?.length || 0,
      hasApiUrl: !!apiUrl,
      apiUrlPrefix: apiUrl ? apiUrl.substring(0, 50) + "..." : "NOT SET"
    });

    let reportData;
    let rawApiResponse: any = null;
    let usedMockData = false;
    let mockReason = "";

    // Check if credentials are configured
    if (!customerId || !userId || !password || !apiUrl) {
      const missingCreds = [];
      if (!customerId) missingCreds.push("EQUIFAX_CUSTOMER_ID");
      if (!userId) missingCreds.push("EQUIFAX_USER_ID");
      if (!password) missingCreds.push("EQUIFAX_PASSWORD");
      if (!apiUrl) missingCreds.push("EQUIFAX_API_URL");
      
      mockReason = `Missing credentials: ${missingCreds.join(", ")}`;
      console.log("[EQUIFAX-DEBUG] " + mockReason);
      console.log("[EQUIFAX-DEBUG] Using mock data due to missing credentials");
      
      usedMockData = true;
      reportData = generateMockResponse(applicantData);
    } else {
      // Build Equifax request
      const stateCode = getStateCode(applicantData.address.state);
      
      const equifaxRequest = {
        RequestHeader: {
          CustomerId: customerId,
          UserId: userId,
          Password: password,
          MemberNumber: memberNumber,
          SecurityCode: securityCode,
          CustRefField: applicationId,
          ProductCode: ["PCS"],
        },
        RequestBody: {
          InquiryPurpose: "05", // Credit Application
          TransactionAmount: "0",
          FirstName: applicantData.firstName,
          MiddleName: applicantData.middleName || "",
          LastName: applicantData.lastName || "",
          InquiryAddresses: [
            {
              seq: "1",
              AddressType: ["H"], // Home
              AddressLine1: applicantData.address.line1,
              State: stateCode,
              Postal: applicantData.address.postal,
            },
          ],
          InquiryPhones: [
            {
              seq: "1",
              Number: applicantData.mobile,
              PhoneType: ["M"], // Mobile
            },
          ],
          IDDetails: applicantData.panNumber
            ? [
                {
                  seq: "1",
                  IDType: "T", // PAN
                  IDValue: applicantData.panNumber,
                  Source: "Inquiry",
                },
              ]
            : applicantData.aadhaarNumber
            ? [
                {
                  seq: "1",
                  IDType: "M", // Aadhaar
                  IDValue: applicantData.aadhaarNumber.replace(/\s/g, ""),
                  Source: "Inquiry",
                },
              ]
            : [],
          DOB: formatDate(applicantData.dob),
          Gender: applicantData.gender === "male" ? "1" : applicantData.gender === "female" ? "2" : "",
          EmailAddress: "",
          GSTStateCode: stateCode,
          Score: {
            Type: "ERS",
            Version: "4.0",
          },
        },
      };

      // Log redacted request payload for debugging
      const redactedRequest = {
        ...equifaxRequest,
        RequestHeader: {
          ...equifaxRequest.RequestHeader,
          Password: "***REDACTED***",
          SecurityCode: "***REDACTED***",
        }
      };
      console.log("[EQUIFAX-DEBUG] ========== REQUEST PAYLOAD ==========");
      console.log("[EQUIFAX-DEBUG] Request payload:", JSON.stringify(redactedRequest, null, 2));
      console.log("[EQUIFAX-DEBUG] API URL:", apiUrl);

      try {
        console.log("[EQUIFAX-DEBUG] ========== CALLING EQUIFAX API ==========");
        console.log("[EQUIFAX-DEBUG] Starting API call at:", new Date().toISOString());
        
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(equifaxRequest),
        });

        console.log("[EQUIFAX-DEBUG] API Response Status:", response.status, response.statusText);
        console.log("[EQUIFAX-DEBUG] Response Headers:", JSON.stringify(Object.fromEntries(response.headers.entries())));

        const responseText = await response.text();
        console.log("[EQUIFAX-DEBUG] ========== RAW RESPONSE ==========");
        console.log("[EQUIFAX-DEBUG] Raw response length:", responseText.length);
        console.log("[EQUIFAX-DEBUG] Raw response (first 2000 chars):", responseText.substring(0, 2000));
        
        if (!response.ok) {
          console.error("[EQUIFAX-DEBUG] API returned error status:", response.status);
          console.error("[EQUIFAX-DEBUG] Full error response:", responseText);
          throw new Error(`Equifax API error: ${response.status} ${response.statusText} - ${responseText.substring(0, 500)}`);
        }

        try {
          rawApiResponse = JSON.parse(responseText);
          console.log("[EQUIFAX-DEBUG] Successfully parsed JSON response");
          console.log("[EQUIFAX-DEBUG] Response structure keys:", Object.keys(rawApiResponse));
        } catch (parseError: any) {
          console.error("[EQUIFAX-DEBUG] Failed to parse JSON response:", parseError.message);
          throw new Error(`Failed to parse Equifax response as JSON: ${parseError.message}`);
        }
        
        reportData = parseEquifaxResponse(rawApiResponse);
        reportData.rawResponse = rawApiResponse;
        console.log("[EQUIFAX-DEBUG] Successfully parsed Equifax response");
        console.log("[EQUIFAX-DEBUG] Credit Score:", reportData.creditScore);
        console.log("[EQUIFAX-DEBUG] Hit Code:", reportData.hitCode, "-", reportData.hitDescription);
        
      } catch (apiError: any) {
        console.error("[EQUIFAX-DEBUG] ========== API CALL FAILED ==========");
        console.error("[EQUIFAX-DEBUG] Error type:", apiError.constructor.name);
        console.error("[EQUIFAX-DEBUG] Error message:", apiError.message);
        console.error("[EQUIFAX-DEBUG] Error stack:", apiError.stack);
        
        mockReason = `API call failed: ${apiError.message}`;
        usedMockData = true;
        
        // Fall back to mock data on API failure
        console.log("[EQUIFAX-DEBUG] Falling back to mock data due to API error");
        reportData = generateMockResponse(applicantData);
        reportData.isMock = true;
        reportData.apiError = apiError.message;
      }
    }

    // Build redacted request for storage (no passwords)
    const redactedRequestForStorage = usedMockData ? null : {
      RequestHeader: {
        CustomerId: customerId,
        UserId: userId,
        Password: "***REDACTED***",
        MemberNumber: memberNumber,
        SecurityCode: "***REDACTED***",
        CustRefField: applicationId,
        ProductCode: ["PCS"],
      },
      RequestBody: {
        InquiryPurpose: "05",
        FirstName: applicantData.firstName,
        MiddleName: applicantData.middleName || "",
        LastName: applicantData.lastName || "",
        InquiryAddresses: [{
          seq: "1",
          AddressType: ["H"],
          AddressLine1: applicantData.address.line1,
          State: getStateCode(applicantData.address.state),
          Postal: applicantData.address.postal,
        }],
        InquiryPhones: [{
          seq: "1",
          Number: applicantData.mobile,
          PhoneType: ["M"],
        }],
        IDDetails: applicantData.panNumber ? [{
          seq: "1",
          IDType: "T",
          IDValue: applicantData.panNumber,
          Source: "Inquiry",
        }] : [],
        DOB: formatDate(applicantData.dob),
        Gender: applicantData.gender === "male" ? "1" : applicantData.gender === "female" ? "2" : "",
      }
    };

    console.log("[EQUIFAX-DEBUG] ========== SAVING TO DATABASE ==========");
    console.log("[EQUIFAX-DEBUG] Used mock data:", usedMockData);
    console.log("[EQUIFAX-DEBUG] Mock reason:", mockReason || "N/A");

    // Save verification to database
    const verificationData = {
      loan_application_id: applicationId,
      applicant_id: applicantId,
      verification_type: "credit_bureau",
      verification_source: "equifax",
      status: reportData.hitCode === "01" ? "success" : "failed",
      request_data: {
        bureau_type: "equifax",
        pan_number: applicantData.panNumber,
        request_timestamp: new Date().toISOString(),
        full_request: redactedRequestForStorage,
        api_url_used: apiUrl || "NOT SET",
        debug_info: {
          used_mock_data: usedMockData,
          mock_reason: mockReason || null,
          credentials_configured: {
            hasCustomerId: !!customerId,
            hasUserId: !!userId,
            hasPassword: !!password,
            hasApiUrl: !!apiUrl,
          }
        }
      },
      response_data: {
        bureau_type: "equifax",
        credit_score: reportData.creditScore,
        score_type: reportData.scoreType,
        score_version: reportData.scoreVersion,
        hit_code: reportData.hitCode,
        hit_description: reportData.hitDescription,
        report_order_no: reportData.reportOrderNo,
        report_date: reportData.reportDate,
        summary: reportData.summary,
        accounts: reportData.accounts,
        enquiries: reportData.enquiries,
        personal_info: reportData.personalInfo,
        active_accounts: reportData.summary.activeAccounts,
        total_outstanding: reportData.summary.totalOutstanding,
        total_overdue: reportData.summary.totalPastDue,
        enquiry_count_30d: reportData.enquiries.total30Days,
        enquiry_count_90d: reportData.enquiries.total90Days,
        name_on_report: reportData.personalInfo.name,
        pan_on_report: reportData.personalInfo.pan,
        is_live_fetch: !usedMockData,
        is_mock: usedMockData,
        raw_api_response: rawApiResponse,
        debug_info: {
          response_timestamp: new Date().toISOString(),
          api_error: reportData.apiError || null,
        }
      },
      remarks: usedMockData 
        ? `[MOCK DATA] ${mockReason} - Credit score: ${reportData.creditScore}`
        : reportData.hitCode === "01" 
          ? `Credit score: ${reportData.creditScore} (${reportData.scoreType} ${reportData.scoreVersion})`
          : `No records found: ${reportData.hitDescription}`,
      verified_at: new Date().toISOString(),
      org_id: orgId,
    };

    // Check for existing verification and update or insert
    const { data: existingVerification } = await supabase
      .from("loan_verifications")
      .select("id")
      .eq("loan_application_id", applicationId)
      .eq("verification_type", "credit_bureau")
      .single();

    if (existingVerification) {
      await supabase
        .from("loan_verifications")
        .update(verificationData)
        .eq("id", existingVerification.id);
    } else {
      await supabase
        .from("loan_verifications")
        .insert(verificationData);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: reportData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in equifax-credit-report:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
