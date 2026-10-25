<?php

namespace App\Services;

use App\Models\AccountingAccount;
use App\Models\AccountingEntry;
use App\Models\Charge;
use App\Models\ClientInvoice;

/**
 * Génère automatiquement les écritures comptables à partir des flux Finance
 * (« mirror Finance ») : chaque facture validée alimente un produit (Ventes),
 * chaque charge alimente le compte de charge correspondant. Écritures à une
 * seule colonne (débit OU crédit), idempotentes via la référence.
 */
class AccountingAutoPostService
{
    /** type de charge → [code, libellé] du compte (plan comptable marocain simplifié). */
    private const CHARGE_ACCOUNTS = [
        'ads' => ['6231', 'Publicité'],
        'salary' => ['6171', 'Rémunérations du personnel'],
        'delivery' => ['6142', 'Transports'],
        'supplier' => ['6111', 'Achats de marchandises'],
        'rent' => ['6131', 'Locations'],
        'tools' => ['6135', 'Outillage et logiciels'],
        'influencer' => ['6232', 'Rémunérations d’intermédiaires (influence)'],
        'other' => ['6148', 'Autres charges externes'],
    ];

    private const SALES_ACCOUNT = ['7111', 'Ventes de marchandises'];

    public function ensureAccount(?int $brandId, string $code, string $label, string $type): AccountingAccount
    {
        return AccountingAccount::query()->firstOrCreate(
            ['brand_id' => $brandId, 'code' => $code],
            ['label' => $label, 'type' => $type],
        );
    }

    /** Facture validée (ou au-delà) → écriture produit au crédit du compte Ventes. */
    public function postInvoice(ClientInvoice $invoice): void
    {
        if (! in_array($invoice->status, ['approved', 'sent', 'paid'], true)) {
            return;
        }
        $total = round((float) $invoice->total, 2);
        if ($total <= 0) {
            return;
        }
        $reference = (string) $invoice->invoice_number;
        $account = $this->ensureAccount($invoice->brand_id, self::SALES_ACCOUNT[0], self::SALES_ACCOUNT[1], 'produit');

        if ($this->entryExists($invoice->brand_id, $account->id, $reference)) {
            return;
        }

        AccountingEntry::query()->create([
            'brand_id' => $invoice->brand_id,
            'account_id' => $account->id,
            'created_by' => $invoice->created_by,
            'entry_date' => ($invoice->approved_at?->toDateString())
                ?? ($invoice->issue_date?->toDateString())
                ?? now()->toDateString(),
            'journal' => 'VT',
            'reference' => $reference,
            'label' => 'Vente – Facture '.$reference,
            'debit' => 0,
            'credit' => $total,
        ]);
    }

    /** Charge → écriture au débit du compte de charge correspondant. */
    public function postCharge(Charge $charge): void
    {
        $amount = round((float) $charge->amount, 2);
        if ($amount <= 0) {
            return;
        }
        [$code, $label] = self::CHARGE_ACCOUNTS[$charge->type] ?? self::CHARGE_ACCOUNTS['other'];
        $account = $this->ensureAccount($charge->brand_id, $code, $label, 'charge');
        $reference = 'CHG-'.$charge->id;

        if ($this->entryExists($charge->brand_id, $account->id, $reference)) {
            return;
        }

        $orderNumber = $charge->order_id
            ? \App\Models\Order::query()->whereKey($charge->order_id)->value('order_number')
            : null;

        AccountingEntry::query()->create([
            'brand_id' => $charge->brand_id,
            'account_id' => $account->id,
            'created_by' => $charge->created_by,
            'entry_date' => $charge->charge_date?->toDateString() ?? now()->toDateString(),
            'journal' => 'AC',
            'reference' => $reference,
            'label' => 'Charge '.$label.($orderNumber ? ' – Commande '.$orderNumber : ''),
            'debit' => $amount,
            'credit' => 0,
        ]);
    }

    private function entryExists(?int $brandId, int $accountId, string $reference): bool
    {
        return AccountingEntry::query()
            ->where('brand_id', $brandId)
            ->where('account_id', $accountId)
            ->where('reference', $reference)
            ->exists();
    }
}
