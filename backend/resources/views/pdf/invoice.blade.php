<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Facture {{ $invoice->invoice_number }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; line-height: 1.5; }
        .page { padding: 40px 50px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .brand-name { font-size: 22px; font-weight: 800; color: #4f46e5; }
        .invoice-title { font-size: 28px; font-weight: 800; color: #18181b; text-align: right; }
        .invoice-number { font-size: 13px; color: #71717a; text-align: right; margin-top: 4px; }
        .meta-grid { display: table; width: 100%; margin-bottom: 30px; }
        .meta-col { display: table-cell; width: 50%; vertical-align: top; }
        .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; margin-bottom: 4px; }
        .meta-value { font-size: 13px; font-weight: 600; color: #27272a; margin-bottom: 12px; }
        .divider { border: none; border-top: 1px solid #e4e4e7; margin: 24px 0; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        table.items thead th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #a1a1aa; padding: 10px 12px; text-align: left; border-bottom: 2px solid #e4e4e7; }
        table.items thead th.right { text-align: right; }
        table.items tbody td { padding: 10px 12px; border-bottom: 1px solid #f4f4f5; font-weight: 500; }
        table.items tbody td.right { text-align: right; }
        .totals { width: 280px; margin-left: auto; }
        .totals-row { display: table; width: 100%; margin-bottom: 6px; }
        .totals-label { display: table-cell; font-size: 12px; color: #71717a; font-weight: 600; }
        .totals-value { display: table-cell; text-align: right; font-size: 13px; font-weight: 700; color: #27272a; }
        .totals-row.total { border-top: 2px solid #18181b; padding-top: 8px; margin-top: 8px; }
        .totals-row.total .totals-label { font-size: 14px; color: #18181b; font-weight: 800; }
        .totals-row.total .totals-value { font-size: 16px; color: #18181b; font-weight: 800; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #a1a1aa; }
    </style>
</head>
<body>
<div class="page">
    <table style="width:100%; margin-bottom: 40px;">
        <tr>
            <td style="vertical-align:top;">
                <div class="brand-name">{{ $brandName }}</div>
            </td>
            <td style="vertical-align:top; text-align:right;">
                <div class="invoice-title">FACTURE</div>
                <div class="invoice-number">{{ $invoice->invoice_number }}</div>
            </td>
        </tr>
    </table>

    <div class="meta-grid">
        <div class="meta-col">
            <div class="meta-label">Client</div>
            <div class="meta-value">{{ $customerName }}</div>
            @if($customerEmail)
                <div class="meta-label">Email</div>
                <div class="meta-value">{{ $customerEmail }}</div>
            @endif
        </div>
        <div class="meta-col" style="text-align:right;">
            <div class="meta-label">Date d'emission</div>
            <div class="meta-value">{{ $invoice->issue_date?->format('d/m/Y') ?? '—' }}</div>
            <div class="meta-label">Periode</div>
            <div class="meta-value">{{ $invoice->billing_period_start?->format('d/m/Y') }} — {{ $invoice->billing_period_end?->format('d/m/Y') }}</div>
            @if($invoice->due_date)
                <div class="meta-label">Echeance</div>
                <div class="meta-value">{{ $invoice->due_date->format('d/m/Y') }}</div>
            @endif
        </div>
    </div>

    <hr class="divider">

    <table class="items">
        <thead>
            <tr>
                <th>Description</th>
                <th class="right">Montant</th>
            </tr>
        </thead>
        <tbody>
            @if($invoice->order)
                <tr>
                    <td>Commande #{{ $invoice->order->order_number ?? $invoice->order->id }}</td>
                    <td class="right">{{ number_format((float)$invoice->subtotal, 2, ',', ' ') }} {{ $currency }}</td>
                </tr>
            @else
                <tr>
                    <td>Services — Periode {{ $invoice->billing_period_start?->format('d/m/Y') }} au {{ $invoice->billing_period_end?->format('d/m/Y') }}</td>
                    <td class="right">{{ number_format((float)$invoice->subtotal, 2, ',', ' ') }} {{ $currency }}</td>
                </tr>
            @endif
        </tbody>
    </table>

    <div class="totals">
        <div class="totals-row">
            <span class="totals-label">Sous-total</span>
            <span class="totals-value">{{ number_format((float)$invoice->subtotal, 2, ',', ' ') }} {{ $currency }}</span>
        </div>
        @if((float)$invoice->discount > 0)
        <div class="totals-row">
            <span class="totals-label">Remise</span>
            <span class="totals-value">-{{ number_format((float)$invoice->discount, 2, ',', ' ') }} {{ $currency }}</span>
        </div>
        @endif
        @if((float)$invoice->tax_amount > 0)
        <div class="totals-row">
            <span class="totals-label">TVA</span>
            <span class="totals-value">{{ number_format((float)$invoice->tax_amount, 2, ',', ' ') }} {{ $currency }}</span>
        </div>
        @endif
        <div class="totals-row total">
            <span class="totals-label">Total</span>
            <span class="totals-value">{{ number_format((float)$invoice->total, 2, ',', ' ') }} {{ $currency }}</span>
        </div>
    </div>

    <div class="footer">
        {{ $brandName }} — Facture generee automatiquement par Nexus CRM
    </div>
</div>
</body>
</html>
