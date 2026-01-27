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

function escapeXml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Convert JSON request object to Equifax XML format (Plain XML)
 */
function jsonToXmlPlain(request: any): string {
  const header = request.RequestHeader;
  const body = request.RequestBody;
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ABOREQUESTINFO>
  <RequestHeader>
    <CustomerId>${escapeXml(header.CustomerId)}</CustomerId>
    <UserId>${escapeXml(header.UserId)}</UserId>
    <Password>${escapeXml(header.Password)}</Password>
    <MemberNumber>${escapeXml(header.MemberNumber)}</MemberNumber>
    <SecurityCode>${escapeXml(header.SecurityCode)}</SecurityCode>
    <CustRefField>${escapeXml(header.CustRefField)}</CustRefField>
    <ProductCode>${Array.isArray(header.ProductCode) ? header.ProductCode[0] : header.ProductCode}</ProductCode>
  </RequestHeader>
  <RequestBody>
    <InquiryPurpose>${escapeXml(body.InquiryPurpose)}</InquiryPurpose>
    <TransactionAmount>${escapeXml(body.TransactionAmount || "0")}</TransactionAmount>
    <FirstName>${escapeXml(body.FirstName)}</FirstName>
    <MiddleName>${escapeXml(body.MiddleName || "")}</MiddleName>
    <LastName>${escapeXml(body.LastName || "")}</LastName>
    <DOB>${escapeXml(body.DOB)}</DOB>
    <Gender>${escapeXml(body.Gender)}</Gender>
    <InquiryAddresses>`;
  
  // Add addresses
  if (body.InquiryAddresses && body.InquiryAddresses.length > 0) {
    body.InquiryAddresses.forEach((addr: any, index: number) => {
      xml += `
      <InquiryAddress seq="${addr.seq || index + 1}">
        <AddressType>${Array.isArray(addr.AddressType) ? addr.AddressType[0] : addr.AddressType}</AddressType>
        <AddressLine1>${escapeXml(addr.AddressLine1)}</AddressLine1>
        <State>${escapeXml(addr.State)}</State>
        <Postal>${escapeXml(addr.Postal)}</Postal>
      </InquiryAddress>`;
    });
  }
  
  xml += `
    </InquiryAddresses>
    <InquiryPhones>`;
  
  // Add phones
  if (body.InquiryPhones && body.InquiryPhones.length > 0) {
    body.InquiryPhones.forEach((phone: any, index: number) => {
      xml += `
      <InquiryPhone seq="${phone.seq || index + 1}">
        <Number>${escapeXml(phone.Number)}</Number>
        <PhoneType>${Array.isArray(phone.PhoneType) ? phone.PhoneType[0] : phone.PhoneType}</PhoneType>
      </InquiryPhone>`;
    });
  }
  
  xml += `
    </InquiryPhones>
    <IDDetails>`;
  
  // Add ID details
  if (body.IDDetails && body.IDDetails.length > 0) {
    body.IDDetails.forEach((id: any, index: number) => {
      xml += `
      <IDDetail seq="${id.seq || index + 1}">
        <IDType>${escapeXml(id.IDType)}</IDType>
        <IDValue>${escapeXml(id.IDValue)}</IDValue>
        <Source>${escapeXml(id.Source)}</Source>
      </IDDetail>`;
    });
  }
  
  xml += `
    </IDDetails>
    <Score>
      <Type>${escapeXml(body.Score?.Type || "ERS")}</Type>
      <Version>${escapeXml(body.Score?.Version || "4.0")}</Version>
    </Score>
  </RequestBody>
</ABOREQUESTINFO>`;

  return xml;
}

/**
 * Convert JSON request object to Equifax SOAP XML format
 */
function jsonToSoapXml(request: any): string {
  const header = request.RequestHeader;
  const body = request.RequestBody;
  
  // Build ID details XML
  let idDetailsXml = "";
  if (body.IDDetails && body.IDDetails.length > 0) {
    body.IDDetails.forEach((id: any, index: number) => {
      idDetailsXml += `
                        <IDDetail seq="${id.seq || index + 1}">
                            <IDType>${escapeXml(id.IDType)}</IDType>
                            <IDValue>${escapeXml(id.IDValue)}</IDValue>
                            <Source>${escapeXml(id.Source)}</Source>
                        </IDDetail>`;
    });
  }

  // Build address XML
  let addressXml = "";
  if (body.InquiryAddresses && body.InquiryAddresses.length > 0) {
    body.InquiryAddresses.forEach((addr: any, index: number) => {
      addressXml += `
                        <InquiryAddress seq="${addr.seq || index + 1}">
                            <AddressType>${Array.isArray(addr.AddressType) ? addr.AddressType[0] : addr.AddressType}</AddressType>
                            <AddressLine1>${escapeXml(addr.AddressLine1 || "NA")}</AddressLine1>
                            <State>${escapeXml(addr.State || "NA")}</State>
                            <Postal>${escapeXml(addr.Postal || "000000")}</Postal>
                        </InquiryAddress>`;
    });
  }

  // Build phone XML
  let phoneXml = "";
  if (body.InquiryPhones && body.InquiryPhones.length > 0) {
    body.InquiryPhones.forEach((phone: any, index: number) => {
      phoneXml += `
                        <InquiryPhone seq="${phone.seq || index + 1}">
                            <Number>${escapeXml(phone.Number)}</Number>
                            <PhoneType>${Array.isArray(phone.PhoneType) ? phone.PhoneType[0] : phone.PhoneType}</PhoneType>
                        </InquiryPhone>`;
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cir="http://cir360service.equifax.com/">
    <soapenv:Header/>
    <soapenv:Body>
        <cir:getReport>
            <cir:request>
                <RequestHeader>
                    <CustomerId>${escapeXml(header.CustomerId)}</CustomerId>
                    <UserId>${escapeXml(header.UserId)}</UserId>
                    <Password>${escapeXml(header.Password)}</Password>
                    <MemberNumber>${escapeXml(header.MemberNumber || "")}</MemberNumber>
                    <SecurityCode>${escapeXml(header.SecurityCode || "")}</SecurityCode>
                    <CustRefField>${escapeXml(header.CustRefField)}</CustRefField>
                    <ProductCode>${Array.isArray(header.ProductCode) ? header.ProductCode[0] : header.ProductCode}</ProductCode>
                </RequestHeader>
                <RequestBody>
                    <InquiryPurpose>${escapeXml(body.InquiryPurpose)}</InquiryPurpose>
                    <TransactionAmount>${escapeXml(body.TransactionAmount || "0")}</TransactionAmount>
                    <FirstName>${escapeXml(body.FirstName)}</FirstName>
                    <MiddleName>${escapeXml(body.MiddleName || "")}</MiddleName>
                    <LastName>${escapeXml(body.LastName || "")}</LastName>
                    <DOB>${escapeXml(body.DOB || "")}</DOB>
                    <Gender>${escapeXml(body.Gender || "")}</Gender>
                    <InquiryAddresses>${addressXml}
                    </InquiryAddresses>
                    <InquiryPhones>${phoneXml}
                    </InquiryPhones>
                    <IDDetails>${idDetailsXml}
                    </IDDetails>
                    <Score>
                        <Type>${escapeXml(body.Score?.Type || "ERS")}</Type>
                        <Version>${escapeXml(body.Score?.Version || "4.0")}</Version>
                    </Score>
                </RequestBody>
            </cir:request>
        </cir:getReport>
    </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Extract value from XML tag using regex
 */
function extractXmlValue(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Extract all occurrences of a tag value
 */
function extractAllXmlValues(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, "gi");
  const matches = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

/**
 * Extract content between opening and closing tags (including nested content)
 */
function extractXmlBlock(xml: string, tagName: string): string {
  const startTag = `<${tagName}`;
  const endTag = `</${tagName}>`;
  const startIndex = xml.indexOf(startTag);
  if (startIndex === -1) return "";
  
  const endIndex = xml.indexOf(endTag, startIndex);
  if (endIndex === -1) return "";
  
  return xml.substring(startIndex, endIndex + endTag.length);
}

/**
 * Extract all blocks of a specific tag
 */
function extractAllXmlBlocks(xml: string, tagName: string): string[] {
  const blocks: string[] = [];
  let searchStart = 0;
  const startTag = `<${tagName}`;
  const endTag = `</${tagName}>`;
  
  while (true) {
    const startIndex = xml.indexOf(startTag, searchStart);
    if (startIndex === -1) break;
    
    const endIndex = xml.indexOf(endTag, startIndex);
    if (endIndex === -1) break;
    
    blocks.push(xml.substring(startIndex, endIndex + endTag.length));
    searchStart = endIndex + endTag.length;
  }
  
  return blocks;
}

/**
 * Parse XML response from Equifax into JSON structure
 */
function xmlToJson(xmlString: string): any {
  console.log("[XML-PARSE] Starting XML to JSON conversion");
  console.log("[XML-PARSE] XML length:", xmlString.length);
  
  try {
    // Check if it's actually JSON (fallback)
    if (xmlString.trim().startsWith("{")) {
      console.log("[XML-PARSE] Response appears to be JSON, parsing directly");
      return JSON.parse(xmlString);
    }
    
    // Extract main sections
    const cirReportDataBlock = extractXmlBlock(xmlString, "CIRReportData") || 
                                extractXmlBlock(xmlString, "CIRReportDataLst");
    
    console.log("[XML-PARSE] CIRReportData block found:", !!cirReportDataBlock);
    
    // Parse Header
    const headerBlock = extractXmlBlock(xmlString, "Header");
    const header = {
      ReportOrderNO: extractXmlValue(headerBlock, "ReportOrderNO"),
      ReportDate: extractXmlValue(headerBlock, "ReportDate"),
      HitCode: extractXmlValue(headerBlock, "HitCode"),
      EnquiryControlNumber: extractXmlValue(headerBlock, "EnquiryControlNumber"),
    };
    console.log("[XML-PARSE] Header parsed:", header);
    
    // Parse Score Details
    const scoreBlock = extractXmlBlock(xmlString, "ScoreDetails") || extractXmlBlock(xmlString, "Score");
    const scoreDetails = {
      Score: extractXmlValue(scoreBlock, "Score") || extractXmlValue(scoreBlock, "Value"),
      Type: extractXmlValue(scoreBlock, "Type"),
      Version: extractXmlValue(scoreBlock, "Version"),
    };
    console.log("[XML-PARSE] Score parsed:", scoreDetails);
    
    // Parse Retail Accounts Summary
    const summaryBlock = extractXmlBlock(xmlString, "RetailAccountsSummary");
    const retailAccountsSummary = {
      TotalBalanceAmount: extractXmlValue(summaryBlock, "TotalBalanceAmount") || 
                          extractXmlValue(summaryBlock, "CurrentBalance"),
      TotalPastDue: extractXmlValue(summaryBlock, "TotalPastDue") || 
                    extractXmlValue(summaryBlock, "AmountPastDue"),
      TotalSanctionAmount: extractXmlValue(summaryBlock, "TotalSanctionAmount") || 
                           extractXmlValue(summaryBlock, "SanctionAmount"),
      OldestAccount: extractXmlValue(summaryBlock, "OldestAccount"),
      RecentAccount: extractXmlValue(summaryBlock, "RecentAccount"),
      TotalCreditLimit: extractXmlValue(summaryBlock, "TotalCreditLimit"),
      TotalMonthlyPaymentAmount: extractXmlValue(summaryBlock, "TotalMonthlyPaymentAmount"),
    };
    
    // Parse Retail Account Details
    const accountBlocks = extractAllXmlBlocks(xmlString, "RetailAccountDetails") ||
                          extractAllXmlBlocks(xmlString, "Account");
    const retailAccountDetails = accountBlocks.map((accBlock: string) => ({
      Institution: extractXmlValue(accBlock, "Institution") || extractXmlValue(accBlock, "ReportingMemberShortName"),
      AccountType: extractXmlValue(accBlock, "AccountType"),
      OwnershipType: extractXmlValue(accBlock, "OwnershipType") || extractXmlValue(accBlock, "Ownership"),
      AccountNumber: extractXmlValue(accBlock, "AccountNumber"),
      AccountStatus: extractXmlValue(accBlock, "AccountStatus") || extractXmlValue(accBlock, "Status"),
      SanctionAmount: extractXmlValue(accBlock, "SanctionAmount") || extractXmlValue(accBlock, "HighCredit"),
      CurrentBalance: extractXmlValue(accBlock, "CurrentBalance") || extractXmlValue(accBlock, "Balance"),
      AmountPastDue: extractXmlValue(accBlock, "AmountPastDue") || extractXmlValue(accBlock, "PastDue"),
      InstallmentAmount: extractXmlValue(accBlock, "InstallmentAmount") || extractXmlValue(accBlock, "EMI"),
      DateOpened: extractXmlValue(accBlock, "DateOpened") || extractXmlValue(accBlock, "OpenDate"),
      DateClosed: extractXmlValue(accBlock, "DateClosed") || extractXmlValue(accBlock, "CloseDate"),
      DateReported: extractXmlValue(accBlock, "DateReported") || extractXmlValue(accBlock, "ReportDate"),
      History48Months: extractXmlValue(accBlock, "History48Months") || extractXmlValue(accBlock, "PaymentHistory"),
    }));
    console.log("[XML-PARSE] Accounts parsed:", retailAccountDetails.length);
    
    // Parse Enquiry Summary
    const enquirySummaryBlock = extractXmlBlock(xmlString, "EnquirySummary");
    const enquirySummary = {
      Last30Days: extractXmlValue(enquirySummaryBlock, "Last30Days") || 
                  extractXmlValue(enquirySummaryBlock, "RecordLast30Days"),
      Last90Days: extractXmlValue(enquirySummaryBlock, "Last90Days") || 
                  extractXmlValue(enquirySummaryBlock, "RecordLast90Days"),
      TotalEnquiries: extractXmlValue(enquirySummaryBlock, "TotalEnquiries") || 
                      extractXmlValue(enquirySummaryBlock, "RecordTotal"),
    };
    
    // Parse Enquiries
    const enquiryBlocks = extractAllXmlBlocks(xmlString, "Enquiry") ||
                          extractAllXmlBlocks(xmlString, "Enquiries");
    const enquiries = enquiryBlocks.map((enqBlock: string) => ({
      Date: extractXmlValue(enqBlock, "Date") || extractXmlValue(enqBlock, "EnquiryDate"),
      Institution: extractXmlValue(enqBlock, "Institution") || extractXmlValue(enqBlock, "MemberName"),
      Purpose: extractXmlValue(enqBlock, "Purpose") || extractXmlValue(enqBlock, "EnquiryPurpose"),
      Amount: extractXmlValue(enqBlock, "Amount") || extractXmlValue(enqBlock, "EnquiryAmount"),
    }));
    
    // Parse Personal Info
    const personalInfoBlock = extractXmlBlock(xmlString, "PersonalInfo") || 
                              extractXmlBlock(xmlString, "IDAndContactInfo");
    const nameBlock = extractXmlBlock(personalInfoBlock, "Name");
    const personalInfo = {
      Name: {
        FirstName: extractXmlValue(nameBlock, "FirstName"),
        MiddleName: extractXmlValue(nameBlock, "MiddleName"),
        LastName: extractXmlValue(nameBlock, "LastName"),
      },
      DateOfBirth: extractXmlValue(personalInfoBlock, "DateOfBirth") || extractXmlValue(personalInfoBlock, "DOB"),
      Gender: extractXmlValue(personalInfoBlock, "Gender"),
    };
    
    // Parse PAN
    const panBlocks = extractAllXmlBlocks(xmlString, "PANId") || extractAllXmlBlocks(xmlString, "IDDetail");
    const panIds = panBlocks
      .filter((block: string) => block.includes("IDType>T<") || block.includes("PAN"))
      .map((block: string) => ({
        IdNumber: extractXmlValue(block, "IdNumber") || extractXmlValue(block, "IDValue"),
      }));
    
    // Parse Address Info
    const addressBlocks = extractAllXmlBlocks(xmlString, "AddressInfo") || 
                          extractAllXmlBlocks(xmlString, "Address");
    const addressInfo = addressBlocks.map((addrBlock: string) => ({
      Address: extractXmlValue(addrBlock, "Address") || extractXmlValue(addrBlock, "AddressLine1"),
      City: extractXmlValue(addrBlock, "City"),
      State: extractXmlValue(addrBlock, "State"),
      Postal: extractXmlValue(addrBlock, "Postal") || extractXmlValue(addrBlock, "PinCode"),
    }));
    
    // Parse Phone Info
    const phoneBlocks = extractAllXmlBlocks(xmlString, "PhoneInfo") || 
                        extractAllXmlBlocks(xmlString, "Phone");
    const phoneInfo = phoneBlocks.map((phoneBlock: string) => ({
      Number: extractXmlValue(phoneBlock, "Number") || extractXmlValue(phoneBlock, "PhoneNumber"),
    }));
    
    // Build the response in the expected format
    const result = {
      INProfileResponse: {
        CIRReportDataLst: [{
          CIRReportData: {
            Header: header,
            ScoreDetails: [scoreDetails],
            RetailAccountsSummary: retailAccountsSummary,
            RetailAccountDetails: retailAccountDetails,
            EnquirySummary: enquirySummary,
            Enquiries: enquiries,
            IDAndContactInfo: {
              PersonalInfo: personalInfo,
              PANId: panIds,
              AddressInfo: addressInfo,
              PhoneInfo: phoneInfo,
            },
          },
        }],
      },
    };
    
    console.log("[XML-PARSE] Conversion complete");
    return result;
    
  } catch (error: any) {
    console.error("[XML-PARSE] Error parsing XML:", error.message);
    throw new Error(`Failed to parse XML response: ${error.message}`);
  }
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

      try {
        // Try multiple request formats - SOAP first, then plain XML, then JSON
        const formats = [
          { 
            name: "SOAP/XML", 
            contentType: "text/xml; charset=utf-8",
            accept: "text/xml",
            body: jsonToSoapXml(equifaxRequest),
            soapAction: "getReport"
          },
          { 
            name: "Plain XML (text/xml)", 
            contentType: "text/xml; charset=utf-8",
            accept: "text/xml, application/xml",
            body: jsonToXmlPlain(equifaxRequest),
            soapAction: null
          },
          { 
            name: "Plain XML (application/xml)", 
            contentType: "application/xml; charset=utf-8",
            accept: "application/xml, text/xml",
            body: jsonToXmlPlain(equifaxRequest),
            soapAction: null
          },
          { 
            name: "JSON", 
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(equifaxRequest),
            soapAction: null
          },
        ];

        let lastError: string | null = null;
        let successResponse: string | null = null;
        let successFormat: string | null = null;

        for (const format of formats) {
          console.log(`[EQUIFAX-DEBUG] ========== TRYING ${format.name} FORMAT ==========`);
          
          // Log redacted request
          const redactedBody = format.body
            .replace(/<Password>[^<]*<\/Password>/g, "<Password>***REDACTED***</Password>")
            .replace(/<SecurityCode>[^<]*<\/SecurityCode>/g, "<SecurityCode>***REDACTED***</SecurityCode>")
            .replace(/"Password":"[^"]*"/g, '"Password":"***REDACTED***"')
            .replace(/"SecurityCode":"[^"]*"/g, '"SecurityCode":"***REDACTED***"');
          
          console.log(`[EQUIFAX-DEBUG] Content-Type: ${format.contentType}`);
          console.log(`[EQUIFAX-DEBUG] Request body (redacted, first 1500 chars):`, redactedBody.substring(0, 1500));
          
          try {
            const headers: Record<string, string> = {
              "Content-Type": format.contentType,
              "Accept": format.accept,
            };
            
            if (format.soapAction) {
              headers["SOAPAction"] = format.soapAction;
            }
            
            const response = await fetch(apiUrl, {
              method: "POST",
              headers,
              body: format.body,
            });

            console.log(`[EQUIFAX-DEBUG] ${format.name} Response Status:`, response.status, response.statusText);
            
            if (response.ok) {
              const responseText = await response.text();
              console.log(`[EQUIFAX-DEBUG] SUCCESS with ${format.name}! Response length:`, responseText.length);
              console.log(`[EQUIFAX-DEBUG] Response (first 2000 chars):`, responseText.substring(0, 2000));
              successResponse = responseText;
              successFormat = format.name;
              break;
            } else {
              const errorText = await response.text();
              console.log(`[EQUIFAX-DEBUG] ${format.name} failed with ${response.status}:`, errorText.substring(0, 500));
              lastError = `${format.name}: ${response.status} ${response.statusText}`;
            }
          } catch (formatError: any) {
            console.error(`[EQUIFAX-DEBUG] ${format.name} threw error:`, formatError.message);
            lastError = `${format.name}: ${formatError.message}`;
          }
        }

        // Process response or throw error
        if (!successResponse) {
          throw new Error(`All request formats failed. Last error: ${lastError}`);
        }

        console.log(`[EQUIFAX-DEBUG] ========== PROCESSING ${successFormat} RESPONSE ==========`);

        try {
          // Try to parse XML response to JSON
          rawApiResponse = xmlToJson(successResponse);
          console.log("[EQUIFAX-DEBUG] Successfully parsed response to JSON");
          console.log("[EQUIFAX-DEBUG] Response structure keys:", Object.keys(rawApiResponse));
        } catch (parseError: any) {
          console.error("[EQUIFAX-DEBUG] Failed to parse response:", parseError.message);
          // Try JSON parsing as fallback
          try {
            rawApiResponse = JSON.parse(successResponse);
            console.log("[EQUIFAX-DEBUG] Fallback: Successfully parsed as JSON");
          } catch {
            throw new Error(`Failed to parse Equifax response: ${parseError.message}`);
          }
        }
        
        reportData = parseEquifaxResponse(rawApiResponse);
        reportData.rawResponse = rawApiResponse;
        reportData.requestFormat = successFormat;
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
        request_format: "xml",
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
          response_format: "xml",
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
