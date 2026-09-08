import { useState, useRef } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@jollify/shared/components/ui/dialog";
import { Button } from "@jollify/shared/components/ui/button";
import { Badge } from "@jollify/shared/components/ui/badge";
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Download, Loader2 } from "lucide-react";
import { supabase } from "@jollify/shared/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const REQUIRED_COLUMNS = ["name", "email", "phone", "gender", "dob", "address", "occupation"];

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  gender?: string;
  dob?: string;
  address?: string;
  occupation?: string;
  _error?: string;
}

interface PreviewState {
  valid: ParsedRow[];
  warnings: string[];
  errors: string[];
}

const BulkImportDialog = ({ open, onOpenChange, onImported }: BulkImportDialogProps) => {
  const { tenant } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [stage, setStage] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [imported, setImported] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setStage("upload");
    setPreview(null);
    setImported(0);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const csv = [
      REQUIRED_COLUMNS.join(","),
      "Jane Smith,jane@example.com,+234 800 000 0001,Female,1990-05-20,12 Marina Rd Lagos,Teacher",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jollify-members-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported.");
      return;
    }
    setFile(f);

    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: ({ data }) => {
        const valid: ParsedRow[] = [];
        const warnings: string[] = [];
        const errors: string[] = [];

        data.forEach((row, i) => {
          const rowNum = i + 2; // account for header
          const name = (row.name ?? "").trim();
          const email = (row.email ?? "").trim().toLowerCase();
          const phone = (row.phone ?? "").trim();

          if (!name || !email || !phone) {
            errors.push(`Row ${rowNum}: name, email, and phone are required.`);
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push(`Row ${rowNum}: invalid email — ${email}`);
            return;
          }

          if (!row.gender) warnings.push(`Row ${rowNum} (${name}): no gender — will import without.`);
          if (!row.dob)    warnings.push(`Row ${rowNum} (${name}): no date of birth — will import without.`);

          valid.push({
            name,
            email,
            phone,
            gender: row.gender?.trim() || undefined,
            dob: row.dob?.trim() || undefined,
            address: row.address?.trim() || undefined,
            occupation: row.occupation?.trim() || undefined,
          });
        });

        setPreview({ valid, warnings, errors });
        setStage("preview");
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!preview || !tenant) return;
    setStage("importing");

    const rows = preview.valid.map((r) => ({
      tenant_id: tenant.id,
      full_name: r.name,
      email: r.email,
      phone: r.phone,
      gender: r.gender ?? null,
      date_of_birth: r.dob ?? null,
      address: r.address ?? null,
      occupation: r.occupation ?? null,
      status: "INVITED",
    }));

    // Insert in batches of 50
    let count = 0;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase.from("members").insert(batch);
      if (error) {
        toast.error(`Import stopped at row ${i + 1}: ${error.message}`);
        setStage("preview");
        return;
      }
      count += batch.length;
    }

    setImported(count);
    setStage("done");
    onImported?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Bulk Import Members
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple members at once.
          </DialogDescription>
        </DialogHeader>

        {/* ── Upload ── */}
        {stage === "upload" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <div>
                <p className="text-sm font-medium">Download template</p>
                <p className="text-xs text-muted-foreground">CSV with all required columns</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />Template
              </Button>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-150
                ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
            >
              <Upload className={`h-8 w-8 mx-auto mb-3 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium text-foreground mb-1">Drag & drop your CSV here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
              <input ref={inputRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Required columns</p>
              <div className="flex flex-wrap gap-1.5">
                {REQUIRED_COLUMNS.map((col) => (
                  <Badge key={col} variant="secondary" className="text-[11px] font-mono">{col}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Preview ── */}
        {stage === "preview" && file && preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <FileSpreadsheet className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={reset}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {preview.valid.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{preview.valid.length} valid member{preview.valid.length !== 1 ? "s" : ""} ready to import</span>
                </div>
              )}
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
              {preview.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <X className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{e}</span>
                </div>
              ))}
            </div>

            {preview.valid.length === 0 ? (
              <p className="text-sm text-destructive text-center py-2">No valid rows to import. Fix the errors and re-upload.</p>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={reset}>Change file</Button>
                <Button className="flex-1" onClick={handleImport}>
                  Import {preview.valid.length} member{preview.valid.length !== 1 ? "s" : ""}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Importing ── */}
        {stage === "importing" && (
          <div className="flex flex-col items-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importing members, please wait…</p>
          </div>
        )}

        {/* ── Done ── */}
        {stage === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Import complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {imported} member{imported !== 1 ? "s" : ""} added. Member IDs have been auto-assigned.
              </p>
            </div>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BulkImportDialog;
