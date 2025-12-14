import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NegativeArea {
  id: string;
  org_id: string;
  area_type: string;
  area_value: string;
  reason: string | null;
  is_active: boolean;
}

interface FormData {
  area_type: string;
  area_value: string;
  reason: string;
  is_active: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingArea: NegativeArea | null;
}

export function AddEditNegativeAreaDialog({ open, onOpenChange, editingArea }: Props) {
  const { orgId } = useOrgContext();
  const notify = useNotification();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, setValue, watch } = useForm<FormData>({
    defaultValues: {
      area_type: "pincode",
      area_value: "",
      reason: "",
      is_active: true,
    },
  });

  const areaType = watch("area_type");
  const isActive = watch("is_active");

  useEffect(() => {
    if (editingArea) {
      setValue("area_type", editingArea.area_type);
      setValue("area_value", editingArea.area_value);
      setValue("reason", editingArea.reason || "");
      setValue("is_active", editingArea.is_active);
    } else {
      reset({
        area_type: "pincode",
        area_value: "",
        reason: "",
        is_active: true,
      });
    }
  }, [editingArea, setValue, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!orgId) throw new Error("No org context");

      if (editingArea) {
        const { error } = await supabase
          .from("loan_negative_areas")
          .update({
            area_type: data.area_type,
            area_value: data.area_value,
            reason: data.reason || null,
            is_active: data.is_active,
          })
          .eq("id", editingArea.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loan_negative_areas")
          .insert({
            org_id: orgId,
            area_type: data.area_type,
            area_value: data.area_value,
            reason: data.reason || null,
            is_active: data.is_active,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["negative-areas"] });
      notify.success(
        editingArea ? "Updated" : "Added",
        `Negative area ${editingArea ? "updated" : "added"} successfully`
      );
      onOpenChange(false);
      reset();
    },
    onError: () => {
      notify.error("Error", "Failed to save negative area");
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingArea ? "Edit Negative Area" : "Add Negative Pin Code"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Area Type</Label>
            <Select
              value={areaType}
              onValueChange={(value) => setValue("area_type", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pincode">Pin Code</SelectItem>
                <SelectItem value="state">State</SelectItem>
                <SelectItem value="city">City</SelectItem>
                <SelectItem value="district">District</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {areaType === "pincode" ? "Pin Code" : areaType.charAt(0).toUpperCase() + areaType.slice(1) + " Name"}
            </Label>
            <Input
              {...register("area_value", { required: true })}
              placeholder={areaType === "pincode" ? "Enter 6-digit pin code" : `Enter ${areaType} name`}
              maxLength={areaType === "pincode" ? 6 : undefined}
            />
          </div>

          <div className="space-y-2">
            <Label>Reason (Optional)</Label>
            <Input
              {...register("reason")}
              placeholder="e.g., High default rate, Remote area"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : editingArea ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
