import { PDFDocument } from 'https://esm.sh/pdf-lib@1.17.1';

/**
 * Safe Base64 encoding that avoids stack overflow for large files
 */
export function safeBase64Encode(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Get the total page count of a PDF
 */
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('[pdfUtils] Error getting page count:', error);
    // Return 1 as fallback - treat as single page
    return 1;
  }
}

/**
 * Extract specific page range from a PDF
 * @param pdfBytes - Original PDF bytes
 * @param startPage - 1-indexed start page (inclusive)
 * @param endPage - 1-indexed end page (inclusive)
 * @returns New PDF bytes containing only the specified pages
 */
export async function extractPdfPages(
  pdfBytes: Uint8Array<ArrayBuffer>,
  startPage: number,
  endPage: number
): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const originalPdf = await PDFDocument.load(pdfBytes as Uint8Array, { ignoreEncryption: true });
    const totalPages = originalPdf.getPageCount();
    
    // Clamp to valid range
    const actualStart = Math.max(1, Math.min(startPage, totalPages));
    const actualEnd = Math.max(actualStart, Math.min(endPage, totalPages));
    
    // Create new PDF with selected pages
    const newPdf = await PDFDocument.create();
    
    // Convert to 0-indexed for pdf-lib
    const pageIndices = [];
    for (let i = actualStart - 1; i < actualEnd; i++) {
      pageIndices.push(i);
    }
    
    const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    
    const newPdfBytes = await newPdf.save();
    return new Uint8Array(newPdfBytes) as Uint8Array<ArrayBuffer>;
  } catch (error) {
    console.error('[pdfUtils] Error extracting pages:', error);
    // Return original if extraction fails
    return pdfBytes;
  }
}

/**
 * Chunk configuration by document type
 */
export const CHUNK_CONFIG: Record<string, { pagesPerChunk: number; maxTokens: number }> = {
  bank_statement: { pagesPerChunk: 5, maxTokens: 4000 },
  cibil_report: { pagesPerChunk: 3, maxTokens: 3000 },
  credit_report: { pagesPerChunk: 3, maxTokens: 3000 },
  itr_year_1: { pagesPerChunk: 5, maxTokens: 4000 },
  itr_year_2: { pagesPerChunk: 5, maxTokens: 4000 },
  form_16_year_1: { pagesPerChunk: 5, maxTokens: 4000 },
  form_16_year_2: { pagesPerChunk: 5, maxTokens: 4000 },
  default: { pagesPerChunk: 5, maxTokens: 4000 },
};

/**
 * Get chunk configuration for a document type
 */
export function getChunkConfig(documentType: string): { pagesPerChunk: number; maxTokens: number } {
  return CHUNK_CONFIG[documentType] || CHUNK_CONFIG.default;
}

/**
 * Merge OCR data from multiple chunks based on document type
 */
export function mergeOcrData(
  existing: Record<string, any>,
  newData: Record<string, any>,
  documentType: string
): Record<string, any> {
  // Remove internal fields from newData
  const { parsed_at, document_type, parse_error, ...newFields } = newData;
  
  // If existing is empty or has parse error, start fresh
  if (!existing || Object.keys(existing).length === 0 || existing.parse_error) {
    return { ...newFields };
  }
  
  // Document-type specific merge strategies
  switch (documentType) {
    case 'bank_statement':
      return mergeBankStatement(existing, newFields);
    
    case 'cibil_report':
    case 'credit_report':
      return mergeCreditReport(existing, newFields);
    
    case 'itr_year_1':
    case 'itr_year_2':
      return mergeITR(existing, newFields);
    
    default:
      // Generic merge: new values override existing, arrays concatenate
      return genericMerge(existing, newFields);
  }
}

/**
 * Merge bank statement data - concatenate transactions, keep latest summary
 */
function mergeBankStatement(existing: Record<string, any>, newData: Record<string, any>): Record<string, any> {
  const merged = { ...existing };
  
  // Concatenate transaction arrays
  if (newData.transactions && Array.isArray(newData.transactions)) {
    merged.transactions = [
      ...(existing.transactions || []),
      ...newData.transactions,
    ];
  }
  
  // Take latest summary values (from later pages)
  const summaryFields = [
    'closing_balance', 'total_credits', 'total_debits', 
    'average_monthly_balance', 'salary_credits', 'emi_debits', 'bounce_count'
  ];
  
  for (const field of summaryFields) {
    if (newData[field] !== undefined && newData[field] !== null && newData[field] !== 0) {
      merged[field] = newData[field];
    }
  }
  
  // Keep opening balance from first chunk
  if (!merged.opening_balance && newData.opening_balance) {
    merged.opening_balance = newData.opening_balance;
  }
  
  // Merge other fields
  for (const [key, value] of Object.entries(newData)) {
    if (!summaryFields.includes(key) && key !== 'transactions' && value !== null && value !== undefined) {
      if (!merged[key] || merged[key] === '' || merged[key] === 0) {
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

/**
 * Merge credit report data - keep score from first chunk, merge accounts
 */
function mergeCreditReport(existing: Record<string, any>, newData: Record<string, any>): Record<string, any> {
  const merged = { ...existing };
  
  // Keep credit score from first chunk (usually on first page)
  // Only override if existing has no score
  if (newData.credit_score && !existing.credit_score) {
    merged.credit_score = newData.credit_score;
  }
  
  // Merge account arrays
  const arrayFields = ['accounts', 'account_details', 'enquiries', 'enquiry_details'];
  for (const field of arrayFields) {
    if (newData[field] && Array.isArray(newData[field])) {
      merged[field] = [
        ...(existing[field] || []),
        ...newData[field],
      ];
    }
  }
  
  // Sum numeric fields that accumulate
  const sumFields = ['active_accounts', 'total_outstanding', 'total_overdue'];
  for (const field of sumFields) {
    if (typeof newData[field] === 'number') {
      merged[field] = (existing[field] || 0) + newData[field];
    }
  }
  
  // Take maximum for enquiry counts (these are cumulative)
  if (newData.enquiry_count_30d !== undefined) {
    merged.enquiry_count_30d = Math.max(existing.enquiry_count_30d || 0, newData.enquiry_count_30d);
  }
  if (newData.enquiry_count_90d !== undefined) {
    merged.enquiry_count_90d = Math.max(existing.enquiry_count_90d || 0, newData.enquiry_count_90d);
  }
  
  // Concatenate DPD history
  if (newData.dpd_history && typeof newData.dpd_history === 'string') {
    if (existing.dpd_history) {
      merged.dpd_history = `${existing.dpd_history}; ${newData.dpd_history}`;
    } else {
      merged.dpd_history = newData.dpd_history;
    }
  }
  
  // Keep other fields from first valid value
  for (const [key, value] of Object.entries(newData)) {
    if (!merged[key] && value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  
  return merged;
}

/**
 * Merge ITR data - mostly single-value fields, take first valid
 */
function mergeITR(existing: Record<string, any>, newData: Record<string, any>): Record<string, any> {
  const merged = { ...existing };
  
  // For ITR, most fields appear once - take first non-null value
  for (const [key, value] of Object.entries(newData)) {
    if (value !== null && value !== undefined && value !== '' && value !== 0) {
      // Only set if not already set
      if (!merged[key] || merged[key] === '' || merged[key] === 0) {
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

/**
 * Generic merge - arrays concatenate, other values take first non-null
 */
function genericMerge(existing: Record<string, any>, newData: Record<string, any>): Record<string, any> {
  const merged = { ...existing };
  
  for (const [key, value] of Object.entries(newData)) {
    if (Array.isArray(value)) {
      merged[key] = [...(existing[key] || []), ...value];
    } else if (value !== null && value !== undefined && value !== '' && value !== 0) {
      if (!merged[key] || merged[key] === '' || merged[key] === 0) {
        merged[key] = value;
      }
    }
  }
  
  return merged;
}

/**
 * Get context-aware prompt for chunked parsing
 */
export function getChunkPrompt(
  basePrompt: string,
  documentType: string,
  startPage: number,
  endPage: number,
  totalPages: number,
  previousData: Record<string, any> | null,
  isFirstChunk: boolean
): string {
  if (isFirstChunk || !previousData) {
    return `${basePrompt}\n\nNote: This is pages ${startPage}-${endPage} of a ${totalPages}-page document. Extract all visible information from these pages.`;
  }
  
  // For continuation chunks, provide context
  const previousSummary = summarizePreviousData(previousData, documentType);
  
  return `You are continuing to analyze pages ${startPage}-${endPage} of a ${totalPages}-page ${documentType.replace(/_/g, ' ')}.\n\nPrevious pages contained: ${previousSummary}\n\nFor THIS chunk only, extract any NEW information visible on these pages that wasn't in the previous analysis.\n${basePrompt}\n\nImportant: Only return NEW data found in these pages. Do not repeat information from previous pages.`;
}

/**
 * Summarize previous data for context in continuation prompts
 */
function summarizePreviousData(data: Record<string, any>, documentType: string): string {
  const summaryParts: string[] = [];
  
  if (documentType === 'bank_statement') {
    if (data.account_number) summaryParts.push(`Account: ${data.account_number}`);
    if (data.bank_name) summaryParts.push(`Bank: ${data.bank_name}`);
    if (data.transactions?.length) summaryParts.push(`${data.transactions.length} transactions found`);
  } else if (documentType.includes('cibil') || documentType.includes('credit')) {
    if (data.credit_score) summaryParts.push(`Score: ${data.credit_score}`);
    if (data.active_accounts) summaryParts.push(`${data.active_accounts} active accounts`);
    if (data.accounts?.length) summaryParts.push(`${data.accounts.length} account details captured`);
  } else {
    // Generic summary
    const keys = Object.keys(data).filter(k => data[k] && data[k] !== 0).slice(0, 5);
    for (const key of keys) {
      summaryParts.push(`${key}: ${JSON.stringify(data[key]).substring(0, 50)}`);
    }
  }
  
  return summaryParts.length > 0 ? summaryParts.join(', ') : 'basic document info';
}

/**
 * Interface for parsing progress tracking
 */
export interface ParsingProgress {
  current_page: number;
  total_pages: number;
  chunks_completed: number;
  total_chunks: number;
  error?: string;
  failed_at_page?: number;
}

/**
 * Calculate parsing progress
 */
export function calculateProgress(
  currentPage: number,
  totalPages: number,
  pagesPerChunk: number
): ParsingProgress {
  const totalChunks = Math.ceil(totalPages / pagesPerChunk);
  const chunksCompleted = Math.ceil(currentPage / pagesPerChunk);
  
  return {
    current_page: currentPage,
    total_pages: totalPages,
    chunks_completed: chunksCompleted,
    total_chunks: totalChunks,
  };
}
