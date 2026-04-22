import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cn } from '../lib/utils';
import { trackSession } from '../lib/session';

type SettingsTab =
  | 'general'
  | 'company'
  | 'whatsapp'
  | 'brands'
  | 'orders'
  | 'delivery'
  | 'stock'
  | 'notifications'
  | 'users'
  | 'finance';

type SettingsModel = {
  general: {
    systemName: string;
    timezone: string;
    currency: string;
    language: string;
    dateFormat: string;
  };
  company: {
    companyName: string;
    phone: string;
    email: string;
    address: string;
    ice: string;
    rc: string;
    if: string;
  };
  whatsapp: {
    connectedNumbers: string[];
    connectionState: 'Connecté' | 'Déconnecté' | 'Partiel';
    webhookStatus: 'OK' | 'KO' | 'Inconnu';
    templatesEnabled: boolean;
  };
  brands: {
    multiBrandEnabled: boolean;
    brandCodeFormat: string;
    defaultBrandId: string;
  };
  orders: {
    statuses: string[];
    sources: string[];
    defaultSource: string;
    defaultPaymentState: 'Non payé' | 'Partiel' | 'Payé';
  };
  delivery: {
    estimatedDays: number;
    carriers: { name: string; active: boolean }[];
    returnsEnabled: boolean;
    returnWindowDays: number;
  };
  stock: {
    defaultLowStockThreshold: number;
    autoCreatePoFromLowStock: boolean;
    allowNegativeStock: boolean;
  };
  notifications: {
    email: boolean;
    inApp: boolean;
    stockAlerts: boolean;
    confirmatriceReminders: boolean;
  };
  users: {
    passwordPolicy: 'Standard' | 'Strict';
    twoFactorRequired: boolean;
    sessionTimeoutMins: number;
  };
  finance: {
    vatRate: number;
    invoicePrefix: string;
    defaultShippingFee: number;
    codFee: number;
  };
};

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function stableStringify(x: unknown) {
  return JSON.stringify(x);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <label className="text-sm font-black text-zinc-800">{label}</label>
        {hint && <span className="text-[11px] font-medium text-zinc-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={cn(
        'w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-zinc-400 text-sm font-semibold text-zinc-900',
        className,
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        'w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm font-semibold text-zinc-900',
        className,
      )}
    >
      {children}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-black text-zinc-800">{label}</p>
        {hint && <p className="mt-1 text-xs font-medium text-zinc-500">{hint}</p>}
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'w-12 h-7 rounded-full p-1 transition-colors',
          checked ? 'bg-emerald-600' : 'bg-zinc-200',
        )}
      >
        <div
          className={cn(
            'w-5 h-5 rounded-full bg-white transition-transform shadow',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

export function SettingsScreen() {
  const initial = useMemo<SettingsModel>(
    () => ({
      general: {
        systemName: 'Nexus CRM',
        timezone: 'Africa/Casablanca',
        currency: 'MAD',
        language: 'fr',
        dateFormat: 'DD/MM/YYYY',
      },
      company: {
        companyName: 'Nexus Ecom SARL',
        phone: '+212 6XX-XXXXXX',
        email: 'contact@nexus.ma',
        address: 'Casablanca, Maroc',
        ice: '',
        rc: '',
        if: '',
      },
      whatsapp: {
        connectedNumbers: ['+212 661-234567', '+212 661-765432'],
        connectionState: 'Partiel',
        webhookStatus: 'Inconnu',
        templatesEnabled: false,
      },
      brands: {
        multiBrandEnabled: true,
        brandCodeFormat: 'AAA-###',
        defaultBrandId: 'b1',
      },
      orders: {
        statuses: ['Nouveau', 'Confirmé', 'Annulé', 'En livraison', 'Livré', 'Retourné'],
        sources: ['Facebook', 'TikTok', 'Instagram', 'Google', 'WhatsApp', 'Autre'],
        defaultSource: 'WhatsApp',
        defaultPaymentState: 'Non payé',
      },
      delivery: {
        estimatedDays: 2,
        carriers: [
          { name: 'Amana', active: true },
          { name: 'Jibli', active: true },
          { name: 'Aramex', active: false },
        ],
        returnsEnabled: true,
        returnWindowDays: 7,
      },
      stock: {
        defaultLowStockThreshold: 15,
        autoCreatePoFromLowStock: false,
        allowNegativeStock: false,
      },
      notifications: {
        email: true,
        inApp: true,
        stockAlerts: true,
        confirmatriceReminders: true,
      },
      users: {
        passwordPolicy: 'Standard',
        twoFactorRequired: false,
        sessionTimeoutMins: 240,
      },
      finance: {
        vatRate: 20,
        invoicePrefix: 'NX-INV',
        defaultShippingFee: 35,
        codFee: 0,
      },
    }),
    [],
  );

  const [tab, setTab] = useState<SettingsTab>('general');
  const [model, setModel] = useState<SettingsModel>(() => deepClone(initial));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = stableStringify(model) !== stableStringify(initial);

  async function save() {
    setSaving(true);
    trackSession({ name: 'audit.settings.save', ts: Date.now(), meta: { tab } });
    await new Promise((r) => setTimeout(r, 700));
    setSaving(false);
    setSavedAt(Date.now());
  }

  function reset() {
    setModel(deepClone(initial));
    trackSession({ name: 'audit.settings.reset', ts: Date.now(), meta: { tab } });
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: 'Général' },
    { id: 'company', label: 'Entreprise' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'brands', label: 'Marques' },
    { id: 'orders', label: 'Commandes' },
    { id: 'delivery', label: 'Livraisons' },
    { id: 'stock', label: 'Stocks' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'users', label: 'Utilisateurs / permissions' },
    { id: 'finance', label: 'Finances' },
  ];

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        title="Configuration"
        subtitle="Centre de configuration du système. Prêt pour branchement backend."
        right={
          <div className="flex items-center gap-2">
            {savedAt && (
              <span className="text-xs font-semibold text-zinc-500">
                Enregistré • {new Date(savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-3">
          <div className="card p-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  trackSession({ name: 'audit.settings.tab', ts: Date.now(), meta: { tab: t.id } });
                }}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-xl text-sm font-black transition-colors',
                  tab === t.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-zinc-50 text-zinc-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="xl:col-span-9 space-y-6">
          {tab === 'general' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Général</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Nom système">
                  <Input
                    value={model.general.systemName}
                    onChange={(e) => setModel({ ...model, general: { ...model.general, systemName: e.target.value } })}
                    placeholder="Nexus CRM"
                  />
                </Field>
                <Field label="Fuseau horaire" hint="Prépare les timestamps / SLA">
                  <Select
                    value={model.general.timezone}
                    onChange={(e) => setModel({ ...model, general: { ...model.general, timezone: e.target.value } })}
                  >
                    <option value="Africa/Casablanca">Africa/Casablanca</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                    <option value="UTC">UTC</option>
                  </Select>
                </Field>
                <Field label="Devise">
                  <Select
                    value={model.general.currency}
                    onChange={(e) => setModel({ ...model, general: { ...model.general, currency: e.target.value } })}
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </Select>
                </Field>
                <Field label="Langue">
                  <Select
                    value={model.general.language}
                    onChange={(e) => setModel({ ...model, general: { ...model.general, language: e.target.value } })}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </Select>
                </Field>
                <Field label="Format date">
                  <Select
                    value={model.general.dateFormat}
                    onChange={(e) => setModel({ ...model, general: { ...model.general, dateFormat: e.target.value } })}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {tab === 'company' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Entreprise</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Nom société">
                  <Input
                    value={model.company.companyName}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, companyName: e.target.value } })}
                  />
                </Field>
                <Field label="Téléphone">
                  <Input
                    value={model.company.phone}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, phone: e.target.value } })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={model.company.email}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, email: e.target.value } })}
                  />
                </Field>
                <Field label="Adresse">
                  <Input
                    value={model.company.address}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, address: e.target.value } })}
                  />
                </Field>
                <Field label="ICE (placeholder)">
                  <Input
                    value={model.company.ice}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, ice: e.target.value } })}
                    placeholder="ICE…"
                  />
                </Field>
                <Field label="RC (placeholder)">
                  <Input
                    value={model.company.rc}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, rc: e.target.value } })}
                    placeholder="RC…"
                  />
                </Field>
                <Field label="IF (placeholder)">
                  <Input
                    value={model.company.if}
                    onChange={(e) => setModel({ ...model, company: { ...model.company, if: e.target.value } })}
                    placeholder="IF…"
                  />
                </Field>
              </div>
            </div>
          )}

          {tab === 'whatsapp' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">WhatsApp</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-muted p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Numéros connectés</p>
                  <div className="mt-3 space-y-2">
                    {model.whatsapp.connectedNumbers.map((n) => (
                      <div key={n} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-zinc-900">{n}</span>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full">
                          Actif
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="card-muted p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">État de connexion</p>
                    <p className="mt-2 text-xl font-black text-zinc-900">{model.whatsapp.connectionState}</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">Placeholder (à binder à l’API / socket).</p>
                  </div>
                  <div className="card-muted p-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Webhook status</p>
                    <p className="mt-2 text-xl font-black text-zinc-900">{model.whatsapp.webhookStatus}</p>
                    <p className="mt-1 text-xs font-medium text-zinc-500">Placeholder.</p>
                  </div>
                </div>
              </div>
              <div className="card-muted p-5">
                <Toggle
                  label="Templates"
                  checked={model.whatsapp.templatesEnabled}
                  onChange={(v) => setModel({ ...model, whatsapp: { ...model.whatsapp, templatesEnabled: v } })}
                  hint="Placeholder (WhatsApp templates)."
                />
              </div>
            </div>
          )}

          {tab === 'orders' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Commandes</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Statuts configurables" hint="Placeholder (liste editable plus tard)">
                  <Input value={model.orders.statuses.join(', ')} readOnly />
                </Field>
                <Field label="Sources" hint="Placeholder">
                  <Input value={model.orders.sources.join(', ')} readOnly />
                </Field>
                <Field label="Source par défaut">
                  <Select
                    value={model.orders.defaultSource}
                    onChange={(e) => setModel({ ...model, orders: { ...model.orders, defaultSource: e.target.value } })}
                  >
                    {model.orders.sources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="État paiement par défaut">
                  <Select
                    value={model.orders.defaultPaymentState}
                    onChange={(e) =>
                      setModel({
                        ...model,
                        orders: { ...model.orders, defaultPaymentState: e.target.value as SettingsModel['orders']['defaultPaymentState'] },
                      })
                    }
                  >
                    <option value="Non payé">Non payé</option>
                    <option value="Partiel">Partiel</option>
                    <option value="Payé">Payé</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {tab === 'delivery' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Livraisons</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Délais estimés (jours)">
                  <Input
                    type="number"
                    value={model.delivery.estimatedDays}
                    onChange={(e) =>
                      setModel({ ...model, delivery: { ...model.delivery, estimatedDays: Number(e.target.value || 0) } })
                    }
                    min={0}
                  />
                </Field>
                <Field label="Paramètres de retour">
                  <div className="card-muted p-4">
                    <Toggle
                      label="Retours activés"
                      checked={model.delivery.returnsEnabled}
                      onChange={(v) => setModel({ ...model, delivery: { ...model.delivery, returnsEnabled: v } })}
                    />
                    <div className="mt-3">
                      <Field label="Fenêtre de retour (jours)" hint="Placeholder">
                        <Input
                          type="number"
                          value={model.delivery.returnWindowDays}
                          onChange={(e) =>
                            setModel({
                              ...model,
                              delivery: { ...model.delivery, returnWindowDays: Number(e.target.value || 0) },
                            })
                          }
                          min={0}
                        />
                      </Field>
                    </div>
                  </div>
                </Field>
              </div>
              <div className="card-muted p-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Transporteurs actifs</p>
                <div className="mt-3 divide-y divide-zinc-100">
                  {model.delivery.carriers.map((c, idx) => (
                    <Toggle
                      key={c.name}
                      label={c.name}
                      checked={c.active}
                      onChange={(v) => {
                        const next = model.delivery.carriers.slice();
                        next[idx] = { ...next[idx], active: v };
                        setModel({ ...model, delivery: { ...model.delivery, carriers: next } });
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Notifications</p>
              <div className="card-muted p-5 divide-y divide-zinc-100">
                <Toggle
                  label="Email"
                  checked={model.notifications.email}
                  onChange={(v) => setModel({ ...model, notifications: { ...model.notifications, email: v } })}
                />
                <Toggle
                  label="In‑app"
                  checked={model.notifications.inApp}
                  onChange={(v) => setModel({ ...model, notifications: { ...model.notifications, inApp: v } })}
                />
                <Toggle
                  label="Alertes stock"
                  checked={model.notifications.stockAlerts}
                  onChange={(v) => setModel({ ...model, notifications: { ...model.notifications, stockAlerts: v } })}
                  hint="Ex: stock bas, rupture, anomalies."
                />
                <Toggle
                  label="Rappels confirmatrices"
                  checked={model.notifications.confirmatriceReminders}
                  onChange={(v) =>
                    setModel({ ...model, notifications: { ...model.notifications, confirmatriceReminders: v } })
                  }
                  hint="Relances à faire, no-answer, SLA."
                />
              </div>
            </div>
          )}

          {tab === 'brands' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Marques</p>
              <div className="card-muted p-5">
                <Toggle
                  label="Mode multi‑marques"
                  checked={model.brands.multiBrandEnabled}
                  onChange={(v) => setModel({ ...model, brands: { ...model.brands, multiBrandEnabled: v } })}
                  hint="Active la segmentation (WhatsApp, commandes, produits, reporting)."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Format code marque" hint="Placeholder (validation plus tard)">
                  <Input
                    value={model.brands.brandCodeFormat}
                    onChange={(e) => setModel({ ...model, brands: { ...model.brands, brandCodeFormat: e.target.value } })}
                    placeholder="AAA-###"
                  />
                </Field>
                <Field label="Marque par défaut">
                  <Select
                    value={model.brands.defaultBrandId}
                    onChange={(e) => setModel({ ...model, brands: { ...model.brands, defaultBrandId: e.target.value } })}
                  >
                    <option value="b1">Luxe Cosmetics</option>
                    <option value="b2">Zest Home</option>
                    <option value="b3">Moda Casa</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}
          {tab === 'stock' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Stocks</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Seuil stock bas par défaut">
                  <Input
                    type="number"
                    min={0}
                    value={model.stock.defaultLowStockThreshold}
                    onChange={(e) =>
                      setModel({ ...model, stock: { ...model.stock, defaultLowStockThreshold: Number(e.target.value || 0) } })
                    }
                  />
                </Field>
                <div className="card-muted p-5">
                  <Toggle
                    label="Autoriser stock négatif"
                    checked={model.stock.allowNegativeStock}
                    onChange={(v) => setModel({ ...model, stock: { ...model.stock, allowNegativeStock: v } })}
                    hint="Désactivé recommandé (intégrité)."
                  />
                </div>
              </div>
              <div className="card-muted p-5">
                <Toggle
                  label="Créer un PO depuis stock bas"
                  checked={model.stock.autoCreatePoFromLowStock}
                  onChange={(v) => setModel({ ...model, stock: { ...model.stock, autoCreatePoFromLowStock: v } })}
                  hint="Placeholder — workflow achats."
                />
              </div>
            </div>
          )}
          {tab === 'users' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Utilisateurs / permissions</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="Politique mot de passe">
                  <Select
                    value={model.users.passwordPolicy}
                    onChange={(e) => setModel({ ...model, users: { ...model.users, passwordPolicy: e.target.value as any } })}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Strict">Strict</option>
                  </Select>
                </Field>
                <Field label="Timeout session (minutes)">
                  <Input
                    type="number"
                    min={10}
                    value={model.users.sessionTimeoutMins}
                    onChange={(e) =>
                      setModel({ ...model, users: { ...model.users, sessionTimeoutMins: Number(e.target.value || 0) } })
                    }
                  />
                </Field>
              </div>
              <div className="card-muted p-5">
                <Toggle
                  label="2FA obligatoire"
                  checked={model.users.twoFactorRequired}
                  onChange={(v) => setModel({ ...model, users: { ...model.users, twoFactorRequired: v } })}
                  hint="Placeholder — à brancher à l’auth."
                />
              </div>
              <div className="card-muted p-5 space-y-2">
                <p className="text-xs font-black text-zinc-900">Rôles (placeholder)</p>
                <p className="text-sm font-medium text-zinc-600">admin • manager • confirmatrice — règles détaillées plus tard.</p>
              </div>
            </div>
          )}
          {tab === 'finance' && (
            <div className="card p-6 space-y-6">
              <p className="text-sm font-black text-zinc-900">Finances</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field label="TVA (%)" hint="Placeholder">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={model.finance.vatRate}
                    onChange={(e) => setModel({ ...model, finance: { ...model.finance, vatRate: Number(e.target.value || 0) } })}
                  />
                </Field>
                <Field label="Préfixe facture">
                  <Input
                    value={model.finance.invoicePrefix}
                    onChange={(e) => setModel({ ...model, finance: { ...model.finance, invoicePrefix: e.target.value } })}
                    placeholder="NX-INV"
                  />
                </Field>
                <Field label="Frais livraison par défaut (MAD)">
                  <Input
                    type="number"
                    min={0}
                    value={model.finance.defaultShippingFee}
                    onChange={(e) =>
                      setModel({ ...model, finance: { ...model.finance, defaultShippingFee: Number(e.target.value || 0) } })
                    }
                  />
                </Field>
                <Field label="Frais COD (MAD)" hint="Optionnel">
                  <Input
                    type="number"
                    min={0}
                    value={model.finance.codFee}
                    onChange={(e) => setModel({ ...model, finance: { ...model.finance, codFee: Number(e.target.value || 0) } })}
                  />
                </Field>
              </div>
              <div className="card-muted p-5 space-y-2">
                <p className="text-xs font-black text-zinc-900">Exports</p>
                <p className="text-sm font-medium text-zinc-600">Placeholder — PDF/Excel, journaux, rapprochement.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save bar */}
      <div
        className={cn(
          'fixed left-0 right-0 bottom-0 z-40 transition-transform',
          dirty ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="max-w-7xl mx-auto px-6 pb-6">
          <div className="card p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-black text-zinc-900">Modifications non enregistrées</p>
              <p className="mt-1 text-xs font-medium text-zinc-500 truncate">Sauvegarde prête — liaison backend plus tard.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={reset}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700 disabled:opacity-70 inline-flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

