import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { STATE_CITY_MAP, INDIAN_STATES } from "./StateCityMap";

interface AddressDetailsStepProps {
  data: {
    currentAddress: {
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      pincode: string;
    };
    permanentAddress: {
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      pincode: string;
    };
    sameAsCurrent: boolean;
    residenceType: string;
  };
  onChange: (data: Partial<AddressDetailsStepProps["data"]>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function AddressDetailsStep({ data, onChange, onNext, onPrev }: AddressDetailsStepProps) {
  const [currentOtherCity, setCurrentOtherCity] = useState("");
  const [permanentOtherCity, setPermanentOtherCity] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!data.currentAddress.addressLine1.trim()) return;
    if (!data.currentAddress.city.trim()) return;
    if (!data.currentAddress.pincode.trim()) return;
    
    onNext();
  };

  const updateCurrentAddress = (field: string, value: string) => {
    const newCurrent = { ...data.currentAddress, [field]: value };
    
    // If changing state, reset city
    if (field === "state") {
      newCurrent.city = "";
      setCurrentOtherCity("");
    }
    
    onChange({ 
      currentAddress: newCurrent,
      permanentAddress: data.sameAsCurrent ? newCurrent : data.permanentAddress
    });
  };

  const updatePermanentAddress = (field: string, value: string) => {
    const newPermanent = { ...data.permanentAddress, [field]: value };
    
    // If changing state, reset city
    if (field === "state") {
      newPermanent.city = "";
      setPermanentOtherCity("");
    }
    
    onChange({ permanentAddress: newPermanent });
  };

  const handleSameAsCurrentChange = (checked: boolean) => {
    onChange({ 
      sameAsCurrent: checked,
      permanentAddress: checked ? data.currentAddress : data.permanentAddress
    });
  };

  const handleCurrentCityChange = (value: string) => {
    if (value === "Other") {
      // Don't set city yet, wait for custom input
      setCurrentOtherCity("");
    } else {
      updateCurrentAddress("city", value);
      setCurrentOtherCity("");
    }
  };

  const handlePermanentCityChange = (value: string) => {
    if (value === "Other") {
      setPermanentOtherCity("");
    } else {
      updatePermanentAddress("city", value);
      setPermanentOtherCity("");
    }
  };

  const validatePincode = (pin: string) => /^[1-9][0-9]{5}$/.test(pin);

  const getCurrentCities = () => {
    return data.currentAddress.state ? STATE_CITY_MAP[data.currentAddress.state] || [] : [];
  };

  const getPermanentCities = () => {
    return data.permanentAddress.state ? STATE_CITY_MAP[data.permanentAddress.state] || [] : [];
  };

  const isCurrentCityOther = data.currentAddress.city && !getCurrentCities().includes(data.currentAddress.city);
  const isPermanentCityOther = data.permanentAddress.city && !getPermanentCities().includes(data.permanentAddress.city);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Address Details</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your current and permanent address
        </p>
      </div>

      {/* Current Address */}
      <div className="space-y-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Current Address
        </h3>
        
        <div className="space-y-2">
          <Label htmlFor="currentLine1">Address Line 1 *</Label>
          <Input
            id="currentLine1"
            value={data.currentAddress.addressLine1}
            onChange={(e) => updateCurrentAddress("addressLine1", e.target.value)}
            placeholder="House/Flat No., Building Name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="currentLine2">Address Line 2</Label>
          <Input
            id="currentLine2"
            value={data.currentAddress.addressLine2}
            onChange={(e) => updateCurrentAddress("addressLine2", e.target.value)}
            placeholder="Street, Landmark"
          />
        </div>

        <div className="space-y-2">
          <Label>State *</Label>
          <Select 
            value={data.currentAddress.state} 
            onValueChange={(value) => updateCurrentAddress("state", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>{state}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>City *</Label>
            {data.currentAddress.state ? (
              <>
                <Select 
                  value={isCurrentCityOther ? "Other" : data.currentAddress.city} 
                  onValueChange={handleCurrentCityChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCurrentCities().map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(isCurrentCityOther || currentOtherCity !== undefined && data.currentAddress.city === "") && (
                  <Input
                    placeholder="Enter city name"
                    value={isCurrentCityOther ? data.currentAddress.city : currentOtherCity}
                    onChange={(e) => {
                      setCurrentOtherCity(e.target.value);
                      updateCurrentAddress("city", e.target.value);
                    }}
                    className="mt-2"
                  />
                )}
              </>
            ) : (
              <Input
                value={data.currentAddress.city}
                onChange={(e) => updateCurrentAddress("city", e.target.value)}
                placeholder="Select state first"
                disabled
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="currentPincode">Pincode *</Label>
            <Input
              id="currentPincode"
              value={data.currentAddress.pincode}
              onChange={(e) => updateCurrentAddress("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="110001"
              maxLength={6}
              required
            />
            {data.currentAddress.pincode && !validatePincode(data.currentAddress.pincode) && (
              <p className="text-xs text-destructive">Invalid pincode</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Residence Type</Label>
          <Select 
            value={data.residenceType} 
            onValueChange={(value) => onChange({ residenceType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owned">Owned</SelectItem>
              <SelectItem value="rented">Rented</SelectItem>
              <SelectItem value="family">Family Owned</SelectItem>
              <SelectItem value="company">Company Provided</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Same as Current Checkbox */}
      <div className="flex items-center space-x-2 py-2">
        <Checkbox
          id="sameAsCurrent"
          checked={data.sameAsCurrent}
          onCheckedChange={handleSameAsCurrentChange}
        />
        <Label htmlFor="sameAsCurrent" className="text-sm cursor-pointer">
          Permanent address is same as current address
        </Label>
      </div>

      {/* Permanent Address (if different) */}
      {!data.sameAsCurrent && (
        <div className="space-y-4 pt-2">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Permanent Address
          </h3>
          
          <div className="space-y-2">
            <Label htmlFor="permLine1">Address Line 1 *</Label>
            <Input
              id="permLine1"
              value={data.permanentAddress.addressLine1}
              onChange={(e) => updatePermanentAddress("addressLine1", e.target.value)}
              placeholder="House/Flat No., Building Name"
              required={!data.sameAsCurrent}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="permLine2">Address Line 2</Label>
            <Input
              id="permLine2"
              value={data.permanentAddress.addressLine2}
              onChange={(e) => updatePermanentAddress("addressLine2", e.target.value)}
              placeholder="Street, Landmark"
            />
          </div>

          <div className="space-y-2">
            <Label>State *</Label>
            <Select 
              value={data.permanentAddress.state} 
              onValueChange={(value) => updatePermanentAddress("state", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City *</Label>
              {data.permanentAddress.state ? (
                <>
                  <Select 
                    value={isPermanentCityOther ? "Other" : data.permanentAddress.city} 
                    onValueChange={handlePermanentCityChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {getPermanentCities().map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(isPermanentCityOther || permanentOtherCity !== undefined && data.permanentAddress.city === "") && (
                    <Input
                      placeholder="Enter city name"
                      value={isPermanentCityOther ? data.permanentAddress.city : permanentOtherCity}
                      onChange={(e) => {
                        setPermanentOtherCity(e.target.value);
                        updatePermanentAddress("city", e.target.value);
                      }}
                      className="mt-2"
                    />
                  )}
                </>
              ) : (
                <Input
                  value={data.permanentAddress.city}
                  onChange={(e) => updatePermanentAddress("city", e.target.value)}
                  placeholder="Select state first"
                  disabled
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="permPincode">Pincode *</Label>
              <Input
                id="permPincode"
                value={data.permanentAddress.pincode}
                onChange={(e) => updatePermanentAddress("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="110001"
                maxLength={6}
                required={!data.sameAsCurrent}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onPrev} className="flex-1">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={
            !data.currentAddress.addressLine1.trim() ||
            !data.currentAddress.city.trim() ||
            !validatePincode(data.currentAddress.pincode) ||
            !data.currentAddress.state
          }
        >
          Continue
        </Button>
      </div>
    </form>
  );
}
