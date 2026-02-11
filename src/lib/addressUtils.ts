/**
 * Safely extract a string address from OCR data that may be:
 * - A plain string
 * - An object like {hindi: "...", english: "..."}
 * - A nested object like {aadhaar_card_details: {address: {english: {s_o, house_number_or_locality, ...}}}}
 * - null/undefined
 */
export function extractAddressString(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // {english: "...", hindi: "..."}
    if (typeof value.english === 'string') return value.english;
    // {english: {s_o, house_number_or_locality, state_and_pincode}}
    if (typeof value.english === 'object' && value.english) {
      const parts = [
        value.english.s_o,
        value.english.house_number_or_locality,
        value.english.street,
        value.english.locality,
        value.english.district,
        value.english.state_and_pincode,
        value.english.state,
        value.english.pincode,
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
    // {combined: "..."}
    if (typeof value.combined === 'string') return value.combined;
    // {hindi: "..."} fallback
    if (typeof value.hindi === 'string') return value.hindi;
  }
  return null;
}

/**
 * Extract address from Aadhaar OCR data, handling all known formats
 */
export function extractAadhaarAddress(backData: any, frontData?: any): string | null {
  if (backData) {
    // Try flat string fields first
    const flat = extractAddressString(backData.address) 
      || extractAddressString(backData.address_english);
    if (flat) return flat;
    
    // Try nested aadhaar_card_details
    const nested = backData.aadhaar_card_details?.address;
    const nestedResult = extractAddressString(nested);
    if (nestedResult) return nestedResult;
  }
  
  if (frontData) {
    const flat = extractAddressString(frontData.address)
      || extractAddressString(frontData.address_english);
    if (flat) return flat;
  }
  
  return null;
}
