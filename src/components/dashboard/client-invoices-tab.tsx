'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Plus, Loader2, ExternalLink, Download, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/date-utils';

// ─── Types (Wave B2 endpoint contract) ──────────────────────────────────────

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface Invoice {
  id: number;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  amountTotalCents: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  description: string | null;
  dueDate: string | null;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
  draft: { label: 'Bozza', className: 'bg-muted text-muted-foreground' },
  open: { label: 'Da pagare', className: 'bg-primary/10 text-primary' },
  paid: { label: 'Pagata', className: 'bg-sage/10 text-sage' },
  void: { label: 'Annullata', className: 'bg-muted text-muted-foreground line-through' },
  uncollectible: {
    label: 'Non riscuotibile',
    className: 'bg-destructive/10 text-destructive',
  },
};

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = statusConfig[status] ?? statusConfig.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Invoices Tab ────────────────────────────────────────────────────────────

export function ClientInvoicesTab({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices?clientId=${encodeURIComponent(clientId)}`);
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data?.invoices ?? []);
      } else {
        setError(json.error?.message || 'Impossibile caricare le fatture');
      }
    } catch {
      setError('Errore di rete durante il caricamento delle fatture');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleCreated = (invoice: Invoice) => {
    setInvoices((prev) => [invoice, ...prev]);
    setShowCreate(false);
    toast({
      title: 'Fattura creata',
      description: invoice.invoiceNumber
        ? `Fattura ${invoice.invoiceNumber}`
        : 'La fattura è stata creata',
    });
    fetchInvoices();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Fatture emesse a questo cliente tramite Stripe.
        </p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Crea fattura
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="mb-4 h-10 w-10 text-destructive" />
            <p className="text-sm font-medium">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchInvoices}>
              Riprova
            </Button>
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">Nessuna fattura</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Crea la prima fattura per questo cliente.
            </p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Crea fattura
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}

      <CreateInvoiceDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        clientId={clientId}
        onCreated={handleCreated}
      />
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{invoice.invoiceNumber || 'Bozza'}</span>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        {invoice.description && (
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{invoice.description}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{formatDate(invoice.createdAt)}</span>
          {invoice.dueDate && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Scadenza {formatDate(invoice.dueDate)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <span className="font-semibold tabular-nums">
          {formatMoney(invoice.amountTotalCents, invoice.currency)}
        </span>
        <div className="flex items-center gap-1">
          {invoice.hostedInvoiceUrl && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a
                href={invoice.hostedInvoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Apri pagina di pagamento Stripe"
                title="Apri pagina di pagamento"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          {invoice.invoicePdfUrl && (
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <a
                href={invoice.invoicePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Scarica PDF della fattura"
                title="Scarica PDF"
              >
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Invoice Dialog ───────────────────────────────────────────────────

function CreateInvoiceDialog({
  open,
  onOpenChange,
  clientId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onCreated: (invoice: Invoice) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDueDate(undefined);
    setFormError(null);
  };

  // Parse a dollar amount string into integer cents. Returns null when invalid.
  const parseAmountCents = (value: string): number | null => {
    const normalized = value.trim().replace(/,/g, '.');
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
    const cents = Math.round(parseFloat(normalized) * 100);
    return cents > 0 ? cents : null;
  };

  const daysUntilDue = (date: Date | undefined): number | undefined => {
    if (!date) return undefined;
    const ms = date.getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setFormError('Inserisci una descrizione.');
      return;
    }
    const amountCents = parseAmountCents(amount);
    if (amountCents === null) {
      setFormError('Inserisci un importo valido maggiore di zero (es. 150.00).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          items: [{ description: trimmedDesc, amountCents, quantity: 1 }],
          description: trimmedDesc,
          daysUntilDue: daysUntilDue(dueDate),
        }),
      });
      const json = await res.json();
      if (json.success) {
        onCreated(json.data);
        resetForm();
      } else {
        const msg = json.error?.message || 'Impossibile creare la fattura';
        setFormError(msg);
        toast({ title: 'Errore', description: msg, variant: 'destructive' });
      }
    } catch {
      const msg = 'Si è verificato un errore imprevisto';
      setFormError(msg);
      toast({ title: 'Errore', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova fattura</DialogTitle>
          <DialogDescription>
            Crea e finalizza una fattura Stripe per questo cliente. Riceverà un link di pagamento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="inv-desc">Descrizione *</Label>
              <Textarea
                id="inv-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="es. Pacchetto coaching — Giugno"
                rows={2}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-amount">Importo (USD) *</Label>
                <Input
                  id="inv-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="150.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Scadenza</Label>
                <DatePicker value={dueDate} onChange={setDueDate} placeholder="Data scadenza" />
              </div>
            </div>
            {formError && (
              <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea fattura
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
