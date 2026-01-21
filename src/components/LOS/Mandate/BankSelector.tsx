import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Building2 } from "lucide-react";

interface Bank {
  id: number;
  bank_id: number;
  name: string;
  bank_code: string;
  mode: string;
}

interface BankSelectorProps {
  banks: Bank[];
  selectedBankId: number | null;
  selectedAuthType: string;
  onBankSelect: (bankId: number, bankName: string) => void;
  onAuthTypeSelect: (authType: string) => void;
  isLoading?: boolean;
}

export default function BankSelector({
  banks,
  selectedBankId,
  selectedAuthType,
  onBankSelect,
  onAuthTypeSelect,
  isLoading = false,
}: BankSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("all");

  // Group banks by bank_id to get available modes for each bank
  const banksByName = useMemo(() => {
    const grouped = new Map<number, { bank: Bank; modes: string[] }>();
    
    banks.forEach((bank) => {
      const existing = grouped.get(bank.bank_id);
      if (existing) {
        if (!existing.modes.includes(bank.mode)) {
          existing.modes.push(bank.mode);
        }
      } else {
        grouped.set(bank.bank_id, { bank, modes: [bank.mode] });
      }
    });
    
    return Array.from(grouped.values());
  }, [banks]);

  // Filter banks based on search and mode
  const filteredBanks = useMemo(() => {
    return banksByName.filter(({ bank, modes }) => {
      const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           bank.bank_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMode = modeFilter === "all" || modes.includes(modeFilter);
      return matchesSearch && matchesMode;
    });
  }, [banksByName, searchQuery, modeFilter]);

  // Get available modes for selected bank
  const selectedBankModes = useMemo(() => {
    if (!selectedBankId) return [];
    const bankData = banksByName.find(({ bank }) => bank.bank_id === selectedBankId);
    return bankData?.modes || [];
  }, [selectedBankId, banksByName]);

  // Popular banks (show first)
  const popularBankCodes = ["HDFC", "ICIC", "SBIN", "AXIS", "KOTK", "PUNB", "UBIN", "BARB"];
  
  const sortedBanks = useMemo(() => {
    return [...filteredBanks].sort((a, b) => {
      const aPopular = popularBankCodes.some(code => 
        a.bank.bank_code.includes(code) || a.bank.name.includes(code)
      );
      const bPopular = popularBankCodes.some(code => 
        b.bank.bank_code.includes(code) || b.bank.name.includes(code)
      );
      
      if (aPopular && !bPopular) return -1;
      if (!aPopular && bPopular) return 1;
      return a.bank.name.localeCompare(b.bank.name);
    });
  }, [filteredBanks]);

  const handleBankClick = (bankId: number, bankName: string) => {
    onBankSelect(bankId, bankName);
    // Reset auth type when bank changes
    onAuthTypeSelect("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <Building2 className="h-8 w-8" />
          <span>Loading banks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bank name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="all">All Modes</option>
          <option value="netbanking">NetBanking</option>
          <option value="debit card">Debit Card</option>
        </select>
      </div>

      {/* Bank Count */}
      <p className="text-sm text-muted-foreground">
        {sortedBanks.length} banks available
      </p>

      {/* Bank List */}
      <ScrollArea className="h-64 border rounded-md">
        <div className="p-2 space-y-1">
          {sortedBanks.map(({ bank, modes }) => (
            <div
              key={bank.bank_id}
              onClick={() => handleBankClick(bank.bank_id, bank.name)}
              className={`p-3 rounded-md cursor-pointer transition-colors ${
                selectedBankId === bank.bank_id
                  ? "bg-primary/10 border border-primary"
                  : "hover:bg-muted border border-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {bank.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{bank.name}</p>
                    <p className="text-xs text-muted-foreground">{bank.bank_code}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {modes.map((mode) => (
                    <Badge key={mode} variant="outline" className="text-xs">
                      {mode === "netbanking" ? "Net" : "DC"}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ))}
          
          {sortedBanks.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <p>No banks found matching your search</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Auth Type Selection (only if bank is selected) */}
      {selectedBankId && selectedBankModes.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <Label>Authorization Mode</Label>
          <RadioGroup
            value={selectedAuthType}
            onValueChange={onAuthTypeSelect}
            className="flex gap-4"
          >
            {selectedBankModes.includes("netbanking") && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="NetBanking" id="netbanking" />
                <Label htmlFor="netbanking" className="cursor-pointer">NetBanking</Label>
              </div>
            )}
            {selectedBankModes.includes("debit card") && (
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="DebitCard" id="debitcard" />
                <Label htmlFor="debitcard" className="cursor-pointer">Debit Card</Label>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="Aadhaar" id="aadhaar" />
              <Label htmlFor="aadhaar" className="cursor-pointer">Aadhaar</Label>
            </div>
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
