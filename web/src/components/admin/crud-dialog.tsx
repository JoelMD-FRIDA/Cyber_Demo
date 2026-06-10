"use client"

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2Icon } from "lucide-react";

export type CrudField = {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "number" | "password" | "select" | "textarea";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

type CrudDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  title: string;
  fields: CrudField[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  defaultValues?: Record<string, unknown>;
};

export function CrudDialog({
  open,
  onOpenChange,
  mode,
  title,
  fields,
  onSubmit,
  loading = false,
  error = null,
  defaultValues = {},
}: CrudDialogProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFormData(mode === "edit" ? { ...defaultValues } : {});
      setLocalError(null);
    }
  }, [open, mode, defaultValues]);

  function handleChange(name: string, value: string) {
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit() {
    setLocalError(null);

    for (const field of fields) {
      if (field.required && !formData[field.name]) {
        setLocalError(`${field.label} is required.`);
        return;
      }
    }

    try {
      await onSubmit(formData);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "An unexpected error occurred.");
    }
  }

  const displayError = error || localError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-admin-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Fill in the details to create a new entry." : "Update the details below."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <label
                htmlFor={`crud-field-${field.name}`}
                className="mx-admin-form-label"
              >
                {field.label}
                {field.required && (
                  <span className="ml-1 text-destructive">*</span>
                )}
              </label>
              {field.type === "select" && field.options ? (
                <select
                  id={`crud-field-${field.name}`}
                  className="mx-admin-select h-9 w-full min-w-0 px-2 py-1 transition-colors outline-none"
                  value={(formData[field.name] as string) || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                >
                  <option value="">Select {field.label}</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  id={`crud-field-${field.name}`}
                  className="mx-admin-textarea h-24 w-full min-w-0 px-2 py-2 transition-colors outline-none placeholder:text-muted-foreground"
                  placeholder={field.placeholder}
                  value={(formData[field.name] as string) || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              ) : (
                <Input
                  id={`crud-field-${field.name}`}
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={(formData[field.name] as string) || ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        {displayError && (
          <p className="text-sm text-destructive">{displayError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
