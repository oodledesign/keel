export type AiInvoiceDraftLine = {
  description: string;
  description_detail: string | null;
  line_type: 'quantity' | 'hours';
  quantity: number;
  unit_price_pence: number;
  total_pence: number;
};

export type AiInvoiceDraft = {
  title: string | null;
  notes: string | null;
  items: AiInvoiceDraftLine[];
};
