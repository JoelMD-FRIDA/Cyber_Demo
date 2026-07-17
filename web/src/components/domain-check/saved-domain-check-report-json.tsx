import { Download, FileText } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SavedDomainCheckReportJsonProps {
  reportJson: string;
  onDownload: () => void;
}

export function SavedDomainCheckReportJson({ reportJson, onDownload }: SavedDomainCheckReportJsonProps) {
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-[var(--stitch-primary)]" />
            Rohdaten-Bericht
          </CardTitle>
          <CardDescription>Der vollständig gespeicherte Domain-Check als unveränderte JSON-Nutzlast.</CardDescription>
        </div>
        <button type="button" onClick={onDownload} className={cn(buttonVariants({ variant: 'default' }), 'w-fit shrink-0')}>
          <Download className="size-4" />
          Bericht herunterladen
        </button>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[34rem] overflow-auto rounded-[var(--stitch-card-radius)] border border-[var(--frida-input-border)] bg-[var(--frida-app-background)] p-4 text-xs leading-relaxed text-[var(--stitch-on-surface)]">
          <code>{reportJson}</code>
        </pre>
      </CardContent>
    </Card>
  );
}
