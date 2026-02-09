import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Shield, Save, Loader2 } from "lucide-react";

interface FeaturePermission {
  feature_key: string;
  feature_name: string;
  category: string;
}

interface DesignationAccess {
  feature_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface Designation {
  id: string;
  name: string;
}

const CATEGORY_ORDER = ["LOS", "Sales & Operations", "Operations", "Management", "Integration"];

export default function AccessManagement() {
  const { orgId } = useAuth();
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [features, setFeatures] = useState<FeaturePermission[]>([]);
  const [selectedDesignation, setSelectedDesignation] = useState<string>("");
  const [accessMap, setAccessMap] = useState<Record<string, DesignationAccess>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load designations and features on mount
  useEffect(() => {
    if (!orgId) return;
    
    const loadData = async () => {
      const [desigRes, featRes] = await Promise.all([
        supabase.from("designations").select("id, name").eq("org_id", orgId).eq("is_active", true).order("name"),
        supabase.from("feature_permissions").select("feature_key, feature_name, category").order("feature_key"),
      ]);
      
      if (desigRes.data) setDesignations(desigRes.data);
      if (featRes.data) setFeatures(featRes.data);
      setLoading(false);
    };
    
    loadData();
  }, [orgId]);

  // Load access for selected designation
  const loadAccess = useCallback(async (designationId: string) => {
    if (!orgId) return;
    
    const { data } = await supabase
      .from("designation_feature_access")
      .select("feature_key, can_view, can_create, can_edit, can_delete")
      .eq("designation_id", designationId)
      .eq("org_id", orgId);

    const map: Record<string, DesignationAccess> = {};
    // Initialize all features with defaults (all true = full access)
    features.forEach(f => {
      map[f.feature_key] = { feature_key: f.feature_key, can_view: true, can_create: true, can_edit: true, can_delete: true };
    });
    // Override with saved restrictions
    data?.forEach(d => {
      map[d.feature_key] = {
        feature_key: d.feature_key,
        can_view: d.can_view ?? true,
        can_create: d.can_create ?? true,
        can_edit: d.can_edit ?? true,
        can_delete: d.can_delete ?? true,
      };
    });
    setAccessMap(map);
  }, [orgId, features]);

  useEffect(() => {
    if (selectedDesignation && features.length > 0) {
      loadAccess(selectedDesignation);
    }
  }, [selectedDesignation, features, loadAccess]);

  const togglePermission = (featureKey: string, permission: keyof DesignationAccess) => {
    if (permission === "feature_key") return;
    setAccessMap(prev => ({
      ...prev,
      [featureKey]: {
        ...prev[featureKey],
        [permission]: !prev[featureKey]?.[permission],
      },
    }));
  };

  const handleSave = async () => {
    if (!orgId || !selectedDesignation) return;
    setSaving(true);

    try {
      // Delete existing entries for this designation
      await supabase
        .from("designation_feature_access")
        .delete()
        .eq("designation_id", selectedDesignation)
        .eq("org_id", orgId);

      // Insert all entries (even full-access ones, so we have explicit records)
      const rows = Object.values(accessMap).map(a => ({
        designation_id: selectedDesignation,
        org_id: orgId,
        feature_key: a.feature_key,
        can_view: a.can_view,
        can_create: a.can_create,
        can_edit: a.can_edit,
        can_delete: a.can_delete,
      }));

      const { error } = await supabase.from("designation_feature_access").insert(rows);
      
      if (error) throw error;
      
      toast({ title: "Saved", description: "Access permissions updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Group features by category
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: features.filter(f => f.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Access Management</h1>
              <p className="text-sm text-muted-foreground">Control feature access per designation</p>
            </div>
          </div>
          {selectedDesignation && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Designation</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedDesignation} onValueChange={setSelectedDesignation}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Choose a designation..." />
              </SelectTrigger>
              <SelectContent>
                {designations.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading && <p className="text-muted-foreground text-sm">Loading...</p>}

        {selectedDesignation && !loading && grouped.map(group => (
          <Card key={group.category}>
            <CardHeader>
              <CardTitle className="text-base">{group.category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Feature</th>
                      <th className="text-center py-2 px-4 font-medium text-muted-foreground">View</th>
                      <th className="text-center py-2 px-4 font-medium text-muted-foreground">Create</th>
                      <th className="text-center py-2 px-4 font-medium text-muted-foreground">Edit</th>
                      <th className="text-center py-2 px-4 font-medium text-muted-foreground">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(feature => {
                      const access = accessMap[feature.feature_key];
                      return (
                        <tr key={feature.feature_key} className="border-b border-border/50">
                          <td className="py-2.5 pr-4 font-medium">{feature.feature_name}</td>
                          {(["can_view", "can_create", "can_edit", "can_delete"] as const).map(perm => (
                            <td key={perm} className="text-center py-2.5 px-4">
                              <Checkbox
                                checked={access?.[perm] ?? true}
                                onCheckedChange={() => togglePermission(feature.feature_key, perm)}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
