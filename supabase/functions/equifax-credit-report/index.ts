import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Pincode prefix to state code mapping for fallback
const PINCODE_STATE_MAP: Record<string, string> = {
  "11": "DL", "12": "HR", "13": "PB", "14": "HP", "15": "JK",
  "16": "PB", "17": "HP", "18": "JK", "19": "JK",
  "20": "UP", "21": "UP", "22": "UP", "23": "UP", "24": "UP",
  "25": "UP", "26": "UP", "27": "UP", "28": "UP",
  "30": "RJ", "31": "RJ", "32": "RJ", "33": "RJ", "34": "RJ",
  "36": "CG", "37": "AP", "38": "GJ", "39": "GJ",
  "40": "MH", "41": "MH", "42": "MH", "43": "MH", "44": "MH",
  "45": "MP", "46": "MP", "47": "MP", "48": "MP", "49": "CG",
  "50": "TS", "51": "TS", "52": "AP", "53": "AP",
  "56": "KA", "57": "KA", "58": "KA", "59": "KA",
  "60": "TN", "61": "TN", "62": "TN", "63": "TN", "64": "TN",
  "67": "KL", "68": "KL", "69": "KL",
  "70": "WB", "71": "WB", "72": "WB", "73": "WB", "74": "WB",
  "75": "OD", "76": "OD", "77": "OD",
  "78": "AS", "79": "AR",
  "80": "BR", "81": "BR", "82": "BR", "83": "BR", "84": "BR",
  "85": "JH", "86": "JH",
};

// Hit code descriptions
const HIT_CODES: Record<string, string> = {
  "10": "Hit - Records found",
  "11": "No Hit - No records found",
  "12": "ACGI - Age Criteria Not Met",
  "13": "ID Scrub Failed",
  "14": "File Frozen",
  "15": "System Error",
  "01": "Hit - Records found (legacy)",
  "02": "No Hit - No records found (legacy)",
};

// Payment status codes
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
  "CLSD": { label: "Closed", severity: "current" },
};

function getStateFromPincode(pincode: string): string {
  if (!pincode || pincode.length < 2) return "";
  return PINCODE_STATE_MAP[pincode.substring(0, 2)] || "";
}

function getStateCode(state: string, pincode?: string): string {
  if (!state && !pincode) return "";
  const normalized = state?.toLowerCase().trim() || "";
  if (normalized.length === 2) return normalized.toUpperCase();
  const directMatch = STATE_CODES[normalized];
  if (directMatch) return directMatch;
  if (pincode) {
    const fromPincode = getStateFromPincode(pincode);
    if (fromPincode) {
      console.log(`[EQUIFAX] State "${state}" not found, inferred ${fromPincode} from pincode ${pincode}`);
      return fromPincode;
    }
  }
  console.log(`[EQUIFAX] Could not determine state for "${state}" pincode "${pincode}"`);
  return state ? state.substring(0, 2).toUpperCase() : "";
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  // Equifax IDCR expects YYYY-MM-DD format (same as database)
  return dateStr;
}

function parseDPDFromPaymentHistory(history: string): number {
  if (!history) return 0;
  const dpdMatch = history.match(/(\d{3})/);
  return dpdMatch ? parseInt(dpdMatch[1], 10) : 0;
}

/**
 * Build IDDetails for IDCR JSON format.
 * Order per IDCR spec: PAN=T, Aadhaar=M, Voter=V, Passport=P, DL=D
 */
function buildIDDetails(panNumber: string, aadhaarNumber: string): any[] {
  return [
    { seq: "1", IDType: "T", IDValue: panNumber || "" },
    { seq: "2", IDType: "M", IDValue: aadhaarNumber ? aadhaarNumber.replace(/\s/g, "") : "" },
    { seq: "3", IDType: "V", IDValue: "" },
    { seq: "4", IDType: "P", IDValue: "" },
    { seq: "5", IDType: "D", IDValue: "" },
  ];
}

/**
 * Parse IDCR (Individual Detailed Credit Report) JSON response from Equifax
 */
function parseEquifaxResponse(response: any): any {
  try {
    console.log("[EQUIFAX-PARSE] Top-level keys:", Object.keys(response));

    // CCRResponse path (CIR 360 JSON / PCS format)
    const ccrResponse = response?.CCRResponse;
    const inProfileResponse = response?.INProfileResponse;

    let inquiryResponse: any = {};
    let header: any = {};
    let scoreDetails: any = {};

    if (ccrResponse?.CIRReportDataLst?.[0]) {
      console.log("[EQUIFAX-PARSE] Using CCRResponse path (IDCR JSON)");
      inquiryResponse = ccrResponse.CIRReportDataLst[0];
      header = inquiryResponse.InquiryResponseHeader || response.InquiryResponseHeader || {};

      // Score: root level or inside CIRReportDataLst item
      const rootScore = response.Score;
      const itemScore = inquiryResponse.Score;
      const scoreArray = rootScore || itemScore || [];
      scoreDetails = scoreArray[0] || {};

      console.log("[EQUIFAX-PARSE] Root Score:", JSON.stringify(rootScore)?.substring(0, 300));
      console.log("[EQUIFAX-PARSE] HitCode:", header.HitCode);
    } else if (inProfileResponse?.CIRReportDataLst?.[0]) {
      console.log("[EQUIFAX-PARSE] Using INProfileResponse path (legacy)");
      inquiryResponse = inProfileResponse.CIRReportDataLst[0];
      header = inquiryResponse.CIRReportData?.Header || {};
      scoreDetails = inquiryResponse.CIRReportData?.ScoreDetails?.[0] || {};
    } else {
      console.error("[EQUIFAX-PARSE] CIRReportDataLst not found. CCRResponse:", JSON.stringify(ccrResponse)?.substring(0, 500));
      throw new Error("Invalid response structure - CIRReportDataLst not found");
    }

    const cirReportData = inquiryResponse.CIRReportData || {};

    // Score extraction: check CIRReportData.ScoreDetails if root score has no numeric value
    console.log("[EQUIFAX-PARSE] cirReportData.ScoreDetails:", JSON.stringify(cirReportData.ScoreDetails)?.substring(0, 300));
    if (!scoreDetails?.Score && !scoreDetails?.Value) {
      const cirScoreArr = cirReportData.ScoreDetails;
      const cirScore = Array.isArray(cirScoreArr) ? cirScoreArr[0] : cirScoreArr;
      if (cirScore?.Score || cirScore?.Value) {
        scoreDetails = cirScore;
        console.log("[EQUIFAX-PARSE] Found score in CIRReportData.ScoreDetails:", JSON.stringify(scoreDetails));
      }
    }

    // RetailAccountsSummary - handle both spellings (with/without trailing "s")
    const retailAccountsSummary = cirReportData.RetailAccountsSummary
      || cirReportData.RetailAccountSummary
      || {};

    const retailAccountDetails = cirReportData.RetailAccountDetails || [];
    const enquirySummary = cirReportData.EnquirySummary || {};
    const enquiries = cirReportData.Enquiries || [];
    const idAndContactInfo = cirReportData.IDAndContactInfo || {};
    const personalInfo = idAndContactInfo.PersonalInfo || {};

    // Personal details
    const name = personalInfo.Name || {};
    const fullName = [name.FirstName, name.MiddleName, name.LastName].filter(Boolean).join(" ");

    // Parse accounts - LIMIT to 15
    const maxAccounts = 15;
    const accountsToProcess = retailAccountDetails.slice(0, maxAccounts);
    const accounts = accountsToProcess.map((acc: any, accIndex: number) => {
      if (accIndex === 0) {
        console.log("[EQUIFAX-PARSE] First account keys:", Object.keys(acc).join(", "));
      }

      const history48MonthsRaw = acc.History48Months;
      const paymentHistory: any[] = [];

      // IDCR JSON: array of objects with PaymentStatus, SuitFiledStatus, AssetClassificationStatus
      if (Array.isArray(history48MonthsRaw)) {
        history48MonthsRaw.forEach((item: any) => {
          const status = item.PaymentStatus || "*";
          paymentHistory.push({
            month: item.key || "",
            status,
            label: PAYMENT_STATUS[status]?.label || status,
            severity: PAYMENT_STATUS[status]?.severity || "current",
            suitFiledStatus: item.SuitFiledStatus || "*",
            assetClassificationStatus: item.AssetClassificationStatus || "*",
          });
        });
      } else if (typeof history48MonthsRaw === "string" && history48MonthsRaw.length > 0) {
        const maxChars = Math.min(history48MonthsRaw.length, 36);
        for (let i = 0; i < maxChars; i += 3) {
          const status = history48MonthsRaw.substring(i, i + 3);
          paymentHistory.push({
            month: Math.floor(i / 3) + 1,
            status,
            label: PAYMENT_STATUS[status]?.label || status,
            severity: PAYMENT_STATUS[status]?.severity || "current",
            suitFiledStatus: "*",
            assetClassificationStatus: "*",
          });
        }
      }

      // Institution name: IDCR uses "Institution" as primary field
      const institutionName = acc.Institution
        || acc.SubscriberName
        || acc.InstitutionName
        || acc.ReportingMemberShortName
        || acc.MemberShortName
        || "Unknown";

      // Determine account status: use Open field ("Yes"/"No") alongside AccountStatus
      let accountStatus = acc.AccountStatus || "Unknown";
      if (acc.Open === "No" && accountStatus !== "Closed" && accountStatus !== "CLOSED") {
        accountStatus = "Closed";
      }

      return {
        institution: institutionName,
        accountType: acc.AccountType || "Unknown",
        ownershipType: acc.OwnershipType || "Individual",
        accountNumber: acc.AccountNumber || "",
        status: accountStatus,
        sanctionAmount: parseFloat(acc.SanctionAmount) || 0,
        currentBalance: parseFloat(acc.Balance || acc.CurrentBalance) || 0,
        pastDueAmount: parseFloat(acc.PastDueAmount || acc.AmountPastDue) || 0,
        lastPayment: parseFloat(acc.LastPayment) || 0,
        emiAmount: parseFloat(acc.InstallmentAmount) || 0,
        highCredit: parseFloat(acc.HighCredit) || 0,
        creditLimit: parseFloat(acc.CreditLimit) || 0,
        interestRate: parseFloat(acc.InterestRate) || 0,
        repaymentTenure: acc.RepaymentTenure || "",
        termFrequency: acc.TermFrequency || "",
        collateralValue: parseFloat(acc.CollateralValue) || 0,
        collateralType: acc.CollateralType || "",
        assetClassification: acc.AssetClassification || "",
        source: acc.source || "",
        dateOpened: acc.DateOpened || "",
        dateClosed: acc.DateClosed || "",
        dateReported: acc.DateReported || "",
        lastPaymentDate: acc.LastPaymentDate || "",
        paymentHistory,
        rawHistory: Array.isArray(history48MonthsRaw)
          ? `array:${history48MonthsRaw.length} months`
          : (history48MonthsRaw || ""),
      };
    });

    // Summary calculations
    const activeAccounts = accounts.filter((a: any) =>
      !["Closed", "CLOSED", "Written Off"].includes(a.status)
    );
    const closedAccounts = accounts.filter((a: any) =>
      ["Closed", "CLOSED"].includes(a.status)
    );
    const writeOffAccounts = accounts.filter((a: any) =>
      a.status === "Written Off" || a.status === "WOF"
    );

    // Enquiries - IDCR uses RequestPurpose (not Purpose) and has Time field
    const parsedEnquiries = enquiries.map((enq: any) => ({
      date: enq.Date || "",
      time: enq.Time || "",
      institution: enq.Institution || "",
      purpose: enq.RequestPurpose || enq.Purpose || "",
    }));

    // Use EnquirySummary from IDCR response if available, fallback to manual calculation
    const enquirySummaryData = enquirySummary || {};
    const enquiries30Days = parseInt(enquirySummaryData.Past30Days) ||
      parsedEnquiries.filter((e: any) => {
        const d = new Date(e.date);
        return d >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }).length;
    const enquiries12Months = parseInt(enquirySummaryData.Past12Months) ||
      parsedEnquiries.filter((e: any) => {
        const d = new Date(e.date);
        return d >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      }).length;
    const enquiries24Months = parseInt(enquirySummaryData.Past24Months) ||
      parsedEnquiries.filter((e: any) => {
        const d = new Date(e.date);
        return d >= new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
      }).length;

    // Credit score - multiple locations
    const creditScore = parseInt(scoreDetails.Score) || parseInt(scoreDetails.Value)
      || parseInt(cirReportData.ScoreCard?.Score) || parseInt(cirReportData.Scores?.[0]?.Value) || 0;

    // Score reasoning elements
    const scoringElements = scoreDetails.ScoringElements || [];

    console.log("[EQUIFAX-PARSE] Final credit score:", creditScore);

    // OtherKeyInd section (IDCR-specific)
    const otherKeyInd = cirReportData.OtherKeyInd || {};

    return {
      reportOrderNo: header.ReportOrderNO || "",
      reportDate: header.Date || header.ReportDate || new Date().toISOString(),
      creditScore,
      scoreType: scoreDetails.Type || "ERS",
      scoreVersion: scoreDetails.Version || "4.0",
      scoreName: scoreDetails.Name || "",
      scoringElements,
      hitCode: header.HitCode || "10",
      hitDescription: HIT_CODES[header.HitCode] || "Unknown",
      summary: {
        // Use IDCR RetailAccountsSummary fields directly
        totalAccounts: parseInt(retailAccountsSummary.NoOfAccounts) || accounts.length,
        activeAccounts: parseInt(retailAccountsSummary.NoOfActiveAccounts) || activeAccounts.length,
        closedAccounts: closedAccounts.length,
        writeOffAccounts: parseInt(retailAccountsSummary.NoOfWriteOffs) || writeOffAccounts.length,
        totalOutstanding: parseFloat(retailAccountsSummary.TotalBalanceAmount) ||
          accounts.reduce((sum: number, a: any) => sum + a.currentBalance, 0),
        totalPastDue: parseFloat(retailAccountsSummary.TotalPastDue) ||
          accounts.reduce((sum: number, a: any) => sum + a.pastDueAmount, 0),
        totalSanctioned: parseFloat(retailAccountsSummary.TotalSanctionAmount) ||
          accounts.reduce((sum: number, a: any) => sum + a.sanctionAmount, 0),
        singleHighestCredit: parseFloat(retailAccountsSummary.SingleHighestCredit) || 0,
        singleHighestSanctionAmount: parseFloat(retailAccountsSummary.SingleHighestSanctionAmount) || 0,
        totalHighCredit: parseFloat(retailAccountsSummary.TotalHighCredit) || 0,
        averageOpenBalance: parseFloat(retailAccountsSummary.AverageOpenBalance) || 0,
        singleHighestBalance: parseFloat(retailAccountsSummary.SingleHighestBalance) || 0,
        noOfPastDueAccounts: parseInt(retailAccountsSummary.NoOfPastDueAccounts) || 0,
        noOfZeroBalanceAccounts: parseInt(retailAccountsSummary.NoOfZeroBalanceAccounts) || 0,
        oldestAccountDate: retailAccountsSummary.OldestAccount || "",
        recentAccountDate: retailAccountsSummary.RecentAccount || "",
        totalCreditLimit: parseFloat(retailAccountsSummary.TotalCreditLimit) || 0,
        totalMonthlyPayment: parseFloat(retailAccountsSummary.TotalMonthlyPaymentAmount) || 0,
      },
      accounts,
      enquiries: {
        total30Days: enquiries30Days,
        total12Months: enquiries12Months,
        total24Months: enquiries24Months,
        totalAll: parseInt(enquirySummaryData.Total) || parsedEnquiries.length,
        recentEnquiryDate: enquirySummaryData.Recent || "",
        list: parsedEnquiries,
      },
      otherKeyIndicators: {
        ageOfOldestTrade: otherKeyInd.AgeOfOldestTrade || "",
        numberOfOpenTrades: otherKeyInd.NumberOfOpenTrades || "",
        allLinesEVER90: otherKeyInd.AllLinesEVER90 || "",
        allLinesSEVERE: otherKeyInd.AllLinesSEVERE || "",
      },
      personalInfo: {
        name: fullName.trim(),
        dob: personalInfo.DateOfBirth || "",
        age: personalInfo.Age?.Age || "",
        pan: idAndContactInfo.IdentityInfo?.PANId?.[0]?.IdNumber
          || idAndContactInfo.PANId?.[0]?.IdNumber || "",
        voterId: idAndContactInfo.IdentityInfo?.VoterID?.[0]?.IdNumber || "",
        nationalId: idAndContactInfo.IdentityInfo?.NationalIDCard?.[0]?.IdNumber || "",
        gender: personalInfo.Gender || "",
        totalIncome: personalInfo.TotalIncome || "",
        occupation: personalInfo.Occupation || "",
        addresses: (idAndContactInfo.AddressInfo || []).map((addr: any) => ({
          address: addr.Address || "",
          state: addr.State || "",
          postal: addr.Postal || "",
          type: addr.Type || "",
          reportedDate: addr.ReportedDate || "",
        })),
        phones: (idAndContactInfo.PhoneInfo || []).map((phone: any) => ({
          number: phone.Number || "",
          type: phone.typeCode || "",
          reportedDate: phone.ReportedDate || "",
        })),
        emails: (idAndContactInfo.EmailAddressInfo || []).map((email: any) => ({
          email: email.EmailAddress || "",
          reportedDate: email.ReportedDate || "",
        })),
      },
    };
  } catch (error) {
    console.error("Error parsing Equifax response:", error);
    throw new Error("Failed to parse credit report response");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
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

    const body = await req.json();
    const { applicantId, applicationId, orgId } = body;

    if (!applicantId || !applicationId || !orgId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: applicantId, applicationId, orgId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch applicant data
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

    // If PAN is missing or masked on applicant record, fetch from parsed PAN card document
    if (!applicant.pan_number || (applicant.pan_number as string).startsWith("XXXXX")) {
      const { data: panDoc } = await supabase
        .from("loan_documents")
        .select("ocr_data")
        .eq("loan_application_id", applicationId)
        .eq("document_type", "pan_card")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const panFromDoc = (panDoc?.ocr_data as any)?.pan_number || (panDoc?.ocr_data as any)?.pan;
      if (panFromDoc) {
        console.log("[EQUIFAX] PAN resolved from parsed document data");
        applicant.pan_number = panFromDoc;
      }
    }

    // Parse current_address JSONB
    const currentAddress = applicant.current_address;
    let addressLine1 = "";
    let addressCity = "";
    let addressState = "";
    let addressPincode = "";

    if (typeof currentAddress === 'object' && currentAddress !== null) {
      addressLine1 = (currentAddress as any).line1 || "";
      addressCity = (currentAddress as any).city || "";
      addressState = (currentAddress as any).state || "";
      addressPincode = (currentAddress as any).pincode || "";
    } else if (typeof currentAddress === 'string') {
      addressLine1 = currentAddress;
    }

    // Fallback: extract pincode/state from line1 if missing
    if (addressLine1 && (!addressPincode || !addressState)) {
      if (!addressPincode) {
        const pincodeMatch = addressLine1.match(/\b(\d{6})\b/);
        if (pincodeMatch) {
          addressPincode = pincodeMatch[1];
          console.log("[EQUIFAX] Extracted pincode from line1:", addressPincode);
        }
      }
      if (!addressState) {
        if (addressPincode) {
          const stateFromPincode = getStateFromPincode(addressPincode);
          if (stateFromPincode) {
            addressState = stateFromPincode;
            console.log("[EQUIFAX] Derived state from pincode:", addressState);
          }
        }
        if (!addressState) {
          const addressLower = addressLine1.toLowerCase();
          for (const [stateName, stateCode] of Object.entries(STATE_CODES)) {
            if (addressLower.includes(stateName)) {
              addressState = stateCode;
              break;
            }
          }
        }
      }
    }

    const applicantData = {
      firstName: applicant.first_name || "",
      middleName: applicant.middle_name || "",
      lastName: applicant.last_name || "",
      dob: applicant.dob || "",
      panNumber: applicant.pan_number || "",
      aadhaarNumber: applicant.aadhaar_number || "",
      mobile: applicant.mobile || "",
      email: applicant.email || "",
      gender: applicant.gender || "",
      address: {
        line1: addressLine1,
        city: addressCity,
        state: addressState,
        postal: addressPincode,
      },
    };

    console.log("[EQUIFAX] Address:", applicantData.address);

    // Get Equifax credentials
    const customerId = Deno.env.get("EQUIFAX_CUSTOMER_ID");
    const userId = Deno.env.get("EQUIFAX_USER_ID");
    const password = Deno.env.get("EQUIFAX_PASSWORD");
    const memberNumber = Deno.env.get("EQUIFAX_MEMBER_NUMBER");
    const securityCode = Deno.env.get("EQUIFAX_SECURITY_CODE");
    const apiUrl = Deno.env.get("EQUIFAX_API_URL");

    console.log("[EQUIFAX] Credentials check:", {
      hasCustomerId: !!customerId,
      hasUserId: !!userId,
      hasPassword: !!password,
      hasMemberNumber: !!memberNumber,
      hasSecurityCode: !!securityCode,
      hasApiUrl: !!apiUrl,
    });

    // All credentials required - no mock data fallback
    if (!customerId || !userId || !password || !apiUrl) {
      const missing = [];
      if (!customerId) missing.push("EQUIFAX_CUSTOMER_ID");
      if (!userId) missing.push("EQUIFAX_USER_ID");
      if (!password) missing.push("EQUIFAX_PASSWORD");
      if (!apiUrl) missing.push("EQUIFAX_API_URL");
      throw new Error(`Missing Equifax credentials: ${missing.join(", ")}. Please configure them in settings.`);
    }

    // Build request - IDCR (Individual Detailed Credit Report) JSON format
    const stateCode = getStateCode(applicantData.address.state, applicantData.address.postal);
    console.log("[EQUIFAX] State code:", stateCode);

    // Build RequestBody per IDCR spec
    const requestBody: any = {
      InquiryPurpose: "00",
      TransactionAmount: "0",
      FirstName: applicantData.firstName,
      MiddleName: applicantData.middleName || "",
      LastName: applicantData.lastName || "",
      DOB: formatDate(applicantData.dob),
      Gender: applicantData.gender === "Female" ? "F" : "M",
      InquiryAddresses: [{
        seq: "1",
        AddressType: ["H"],
        AddressLine1: applicantData.address.line1,
        AddressLine2: "",
        Locality: applicantData.address.city,
        City: applicantData.address.city,
        State: stateCode,
        Postal: applicantData.address.postal,
      }],
      InquiryPhones: [{
        seq: "1",
        PhoneType: ["M"],
        Number: applicantData.mobile,
      }],
      EmailAddresses: [{
        seq: "1",
        Email: applicantData.email || "",
        EmailType: ["O"],
      }],
      IDDetails: buildIDDetails(applicantData.panNumber, applicantData.aadhaarNumber),
      CustomFields: [
        { key: "EmbeddedPdf", value: "Y" },
      ],
    };

    const equifaxRequest = {
      RequestHeader: {
        CustomerId: customerId,
        UserId: userId,
        Password: password,
        MemberNumber: memberNumber,
        SecurityCode: securityCode,
        CustRefField: applicationId,
        ProductCode: ["IDCR"],
      },
      RequestBody: requestBody,
      Score: [{ Type: "ERS", Version: "4.0" }],
    };

    let reportData;
    let rawApiResponse: any = null;

    try {
      console.log("[EQUIFAX] ========== SENDING IDCR JSON REQUEST ==========");

      const redactedBody = JSON.stringify(equifaxRequest)
        .replace(/"Password":"[^"]*"/g, '"Password":"***REDACTED***"')
        .replace(/"SecurityCode":"[^"]*"/g, '"SecurityCode":"***REDACTED***"');
      console.log("[EQUIFAX] Request (redacted):", redactedBody);

      // 300-second timeout (reports can be very large)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

      let response: Response;
      try {
        response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(equifaxRequest),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error("Equifax API request timed out after 25 seconds");
        }
        throw fetchError;
      }

      console.log("[EQUIFAX] Response Status:", response.status, response.statusText);
      console.log("[EQUIFAX] Response Content-Type:", response.headers.get("content-type"));

      let responseText = await response.text();
      console.log("[EQUIFAX] Response length:", responseText.length);

      // Strip UTF-8 BOM and leading/trailing whitespace
      responseText = responseText.replace(/^\uFEFF/, "").trim();
      console.log("[EQUIFAX] Response preview:", responseText.substring(0, 500));

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${responseText.substring(0, 500)}`);
      }

      try {
        rawApiResponse = JSON.parse(responseText);
        console.log("[EQUIFAX] Response keys:", Object.keys(rawApiResponse));
      } catch (parseError: any) {
        console.error("[EQUIFAX] Raw response (first 500 chars):", responseText.substring(0, 500));
        console.error("[EQUIFAX] First 20 char codes:", [...responseText.substring(0, 20)].map(c => c.charCodeAt(0)));
        throw new Error(`Failed to parse Equifax response as JSON. Response: ${responseText.substring(0, 300)}`);
      }

      // Check for API error response
      if (rawApiResponse?.Error?.ErrorCode) {
        const errorCode = rawApiResponse.Error.ErrorCode;
        const errorDesc = rawApiResponse.Error.ErrorDesc || "Unknown error";
        console.error("[EQUIFAX] API Error:", errorCode, errorDesc);
        throw new Error(`Equifax API Error ${errorCode}: ${errorDesc}`);
      }

      reportData = parseEquifaxResponse(rawApiResponse);
      reportData.rawResponse = rawApiResponse;
      reportData.requestFormat = "idcr_json";
      console.log("[EQUIFAX] Credit Score:", reportData.creditScore, "Hit Code:", reportData.hitCode);

    } catch (apiError: any) {
      console.error("[EQUIFAX] API call failed:", apiError.message);
      throw new Error(`Failed to fetch credit report: ${apiError.message}`);
    }

    // Build redacted request for storage - matches actual IDCR request structure
    const redactedRequestForStorage = {
      RequestHeader: {
        CustomerId: customerId,
        UserId: userId,
        Password: "***REDACTED***",
        MemberNumber: memberNumber,
        SecurityCode: "***REDACTED***",
        CustRefField: applicationId,
        ProductCode: ["IDCR"],
      },
      RequestBody: {
        InquiryPurpose: "00",
        TransactionAmount: "0",
        FirstName: applicantData.firstName,
        MiddleName: applicantData.middleName || "",
        LastName: applicantData.lastName || "",
        DOB: formatDate(applicantData.dob),
        Gender: applicantData.gender === "Female" ? "F" : "M",
        InquiryAddresses: [{
          seq: "1",
          AddressType: ["H"],
          AddressLine1: applicantData.address.line1,
          Locality: applicantData.address.city,
          City: applicantData.address.city,
          State: stateCode,
          Postal: applicantData.address.postal,
        }],
        InquiryPhones: [{
          seq: "1",
          Number: applicantData.mobile,
          PhoneType: ["M"],
        }],
        IDDetails: buildIDDetails(applicantData.panNumber, applicantData.aadhaarNumber).map(id => ({
          ...id,
          IDValue: id.IDType === "T" && id.IDValue ? id.IDValue.substring(0, 3) + "***" : id.IDValue ? "***" : "",
        })),
      },
      Score: [{ Type: "ERS", Version: "4.0" }],
    };

    console.log("[EQUIFAX] ========== SAVING TO DATABASE ==========");

    const verificationData = {
      loan_application_id: applicationId,
      applicant_id: applicantId,
      verification_type: "credit_bureau",
      verification_source: "equifax",
      status: (reportData.hitCode === "10" || reportData.hitCode === "01") ? "success" : "failed",
      request_data: {
        bureau_type: "equifax",
        product_code: "IDCR",
        pan_number: applicantData.panNumber,
        request_timestamp: new Date().toISOString(),
        full_request: redactedRequestForStorage,
        api_url_used: apiUrl,
        request_format: "idcr_json",
      },
      response_data: {
        bureau_type: "equifax",
        product_code: "IDCR",
        credit_score: reportData.creditScore,
        score_type: reportData.scoreType,
        score_version: reportData.scoreVersion,
        score_name: reportData.scoreName,
        scoring_elements: reportData.scoringElements,
        hit_code: reportData.hitCode,
        hit_description: reportData.hitDescription,
        report_order_no: reportData.reportOrderNo,
        report_date: reportData.reportDate,
        summary: reportData.summary,
        accounts: reportData.accounts,
        enquiries: reportData.enquiries,
        other_key_indicators: reportData.otherKeyIndicators,
        personal_info: reportData.personalInfo,
        active_accounts: reportData.summary.activeAccounts,
        total_outstanding: reportData.summary.totalOutstanding,
        total_overdue: reportData.summary.totalPastDue,
        enquiry_count_30d: reportData.enquiries.total30Days,
        enquiry_count_12m: reportData.enquiries.total12Months,
        enquiry_count_24m: reportData.enquiries.total24Months,
        name_on_report: reportData.personalInfo.name,
        pan_on_report: reportData.personalInfo.pan,
        is_live_fetch: true,
        is_mock: false,
        raw_api_response: {
          summary: "Full response parsed into structured data above",
          hitCode: reportData?.hitCode,
          accountCount: reportData?.accounts?.length || 0,
        },
        debug_info: {
          response_timestamp: new Date().toISOString(),
          response_format: "idcr_json",
        }
      },
      remarks: (reportData.hitCode === "10" || reportData.hitCode === "01")
        ? `Credit score: ${reportData.creditScore} (${reportData.scoreType} ${reportData.scoreVersion})`
        : `No records found: ${reportData.hitDescription}`,
      verified_at: new Date().toISOString(),
      org_id: orgId,
    };

    // Upsert verification
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
      JSON.stringify({ success: true, data: reportData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in equifax-credit-report:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
