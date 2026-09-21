import React, { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock, FileText, MessageSquare, Paperclip, Search, Send, Smile, Trash2 } from 'lucide-react';
import { StatusChip } from '../components/ui/StatusChip';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn, formatCurrency } from '../lib/utils';
import type { OrderDraft } from '../domain/orders';
import { trackSession } from '../lib/session';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as api from '../lib/api';
import { isPaginator, type LaravelPaginator } from '../lib/apiTypes';

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDayDivider(d: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today)) return "Aujourd'hui";
  if (isSameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

type ApiConversation = {
  id: number;
  status: string;
  channel: string;
  brand_id?: number;
  assigned_user_id?: number | null;
  last_message_at: string | null;
  last_message_content?: string | null;
  last_message_status?: 'sent' | 'delivered' | 'read' | 'failed' | null;
  last_message_direction?: 'inbound' | 'outbound' | null;
  unread_count?: number;
  is_waiting_agent_reply?: boolean;
  waiting_agent_reply_minutes?: number;
  needs_reply_alert?: boolean;
  customer?: { full_name: string; phone: string } | null;
  lead?: { id: number } | null;
  brand?: { id: number; name: string } | null;
  assigned_user?: { id: number; name: string } | null;
  whatsapp_number_id?: number | null;
  whatsapp_number?: { id: number; label: string | null; display_number: string | null; phone_id: string } | null;
};

type WaNumber = {
  id: number;
  label: string | null;
  display_number: string | null;
  phone_id: string;
  is_default: boolean;
};

function waNumberLabel(n: Pick<WaNumber, 'label' | 'display_number' | 'phone_id'>): string {
  return n.display_number || n.label || `Phone ID ${n.phone_id}`;
}

type ApiUser = { id: number; name: string; email: string; roles?: { id: number; slug: string }[] };

type ApiMessage = {
  id: number;
  direction: 'inbound' | 'outbound';
  content: string | null;
  message_type?: string | null;
  media_url?: string | null;
  sent_at: string | null;
  sender?: { name: string } | null;
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed' | null;
  delivery_error?: string | null;
};

type ApiCustomer = { id: number; full_name: string; phone: string };

const MANDATORY_CONVERSATION_STATUSES = ['en_cours_traitement', 'pas_de_reponse', 'vu_non_repondu', 'confirme', 'a_suivre', 'livre'] as const;
const ON_READ_ALERT_MINUTES = 5;

const TEMPLATE_CATEGORY_FR: Record<string, string> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utilitaire',
  AUTHENTICATION: 'Authentification',
};

const CONVERSATION_STATUS_OPTIONS = [
  { value: 'en_cours_traitement', label: 'En cours de traitement' },
  { value: 'pas_de_reponse', label: 'Pas de reponse' },
  { value: 'vu_non_repondu', label: 'Vu non repondu' },
  { value: 'confirme', label: 'Confirme' },
  { value: 'a_suivre', label: 'A suivre' },
  { value: 'livre', label: 'Livre' },
] as const;

function isMandatoryStatus(status: string): boolean {
  return MANDATORY_CONVERSATION_STATUSES.includes(status as (typeof MANDATORY_CONVERSATION_STATUSES)[number]);
}

export function WhatsAppWorkspaceScreen({
  onCreateOrderFromLead,
}: {
  onCreateOrderFromLead: (draft: Partial<OrderDraft>) => void;
}) {
  const { activeBrandId, activeBrand } = useBrand();
  const { user, hasPermission, roleSlugs } = useAuth();
  const toast = useToast();

  const isConfirmatrice = Array.isArray(roleSlugs) && roleSlugs.includes('confirmatrice');
  const canViewConversations = hasPermission('conversations.view') || isConfirmatrice;
  const canCreateConversations = hasPermission('conversations.create') || isConfirmatrice;

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  // Template picker
  type WaTemplate = { name: string; language: string; category: string; status: string; body: string; param_count: number };
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [waProducts, setWaProducts] = useState<{ id: number; name: string; price: number; stock: number }[]>([]);
  const [orderMode, setOrderMode] = useState(false);
  const [orderLines, setOrderLines] = useState<{ name: string; qty: string }[]>([{ name: '', qty: '1' }]);
  const [orderPrepaid, setOrderPrepaid] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [openedAtByConversation, setOpenedAtByConversation] = useState<Record<number, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [newOpen, setNewOpen] = useState(false);
  const [newTab, setNewTab] = useState<'existing' | 'new'>('existing');
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomerId, setNewCustomerId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [initMode, setInitMode] = useState<'template' | 'free' | 'none'>('template');
  const [initTemplate, setInitTemplate] = useState('');
  const [initText, setInitText] = useState('');
  const [newError, setNewError] = useState<string | null>(null);
  const [agents, setAgents] = useState<ApiUser[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('');
  const [numbers, setNumbers] = useState<WaNumber[]>([]);
  const [numberFilter, setNumberFilter] = useState<string>('');
  const [newNumberId, setNewNumberId] = useState<string>('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e: MouseEvent) => { if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiOpen]);

  useEffect(() => {
    setSelectedId(null);
    setMessages([]);
    setConversations([]);
    setNumberFilter('');
  }, [activeBrandId]);

  // Load the brand's imported WhatsApp numbers (for separate inboxes).
  useEffect(() => {
    if (!activeBrandId) {
      setNumbers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await api.get<{ numbers: WaNumber[] }>('whatsapp/numbers');
      if (cancelled) return;
      if (res.ok && res.data) setNumbers(res.data.numbers ?? []);
      else setNumbers([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBrandId]);

  const loadConversations = useCallback(async (silent = false) => {
    if (!activeBrandId) {
      setConversations([]);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ per_page: '100' });
    if (agentFilter) params.set('assigned_user_id', agentFilter);
    if (numberFilter) params.set('whatsapp_number_id', numberFilter);
    const res = await api.get<LaravelPaginator<ApiConversation>>(`conversations?${params.toString()}`);
    if (!silent) setLoading(false);
    if (!res.ok) {
      if (!silent) toast.error(res.message);
      if (!silent) setConversations([]);
      return;
    }
    setConversations(isPaginator<ApiConversation>(res.data) ? res.data.data : []);
  }, [activeBrandId, agentFilter, numberFilter, toast]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Auto-refresh conversations every 5s
  useEffect(() => {
    const timer = window.setInterval(() => { void loadConversations(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  const loadMessages = useCallback(
    async (cid: number, silent = false) => {
      if (!silent) setMsgLoading(true);
      const res = await api.get<LaravelPaginator<ApiMessage>>(`conversations/${cid}/messages?per_page=100`);
      if (!silent) setMsgLoading(false);
      if (!res.ok) {
        if (!silent) toast.error(res.message);
        if (!silent) setMessages([]);
        return;
      }
      setMessages(isPaginator<ApiMessage>(res.data) ? res.data.data : []);
    },
    [toast],
  );

  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [selectedId, loadMessages]);

  // Auto-refresh messages every 3s when a conversation is open
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => { void loadMessages(selectedId, true); }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadMessages]);

  // Agent presence: another agent typing + team last-read timestamp.
  const [presence, setPresence] = useState<{ agent_typing: { user_id: number; name: string } | null; agent_last_read_at: string | null }>({ agent_typing: null, agent_last_read_at: null });
  const lastTypingPingRef = useRef<number>(0);
  useEffect(() => {
    if (!selectedId) { setPresence({ agent_typing: null, agent_last_read_at: null }); return; }
    const poll = async () => {
      const res = await api.get<{ agent_typing: { user_id: number; name: string } | null; agent_last_read_at: string | null }>(`conversations/${selectedId}/presence`);
      if (res.ok && res.data) setPresence(res.data);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  const pingTyping = useCallback(() => {
    if (!selectedId) return;
    const now = Date.now();
    if (now - lastTypingPingRef.current < 2000) return;
    lastTypingPingRef.current = now;
    void api.post(`conversations/${selectedId}/typing`, {});
  }, [selectedId]);

  // Default the new-conversation number picker: current inbox filter, else brand default.
  useEffect(() => {
    if (!newOpen) return;
    if (numbers.length === 0) {
      setNewNumberId('');
      return;
    }
    const preferred = numberFilter || String(numbers.find((n) => n.is_default)?.id ?? numbers[0].id);
    setNewNumberId(preferred);
  }, [newOpen, numbers, numberFilter]);

  // Search on the server (all clients, every phone format) instead of filtering the first 200 locally.
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      if (!activeBrandId || !newOpen) return;
      const q = customerSearch.trim();
      const res = await api.get<LaravelPaginator<ApiCustomer>>(
        `customers?per_page=50${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      );
      if (cancelled) return;
      if (res.ok && isPaginator<ApiCustomer>(res.data)) setCustomers(res.data.data);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [activeBrandId, newOpen, customerSearch]);

  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return conversations.filter((c) => {
      const name = c.customer?.full_name ?? `Conversation #${c.id}`;
      const phone = c.customer?.phone ?? '';
      if (!s) return true;
      return name.toLowerCase().includes(s) || phone.toLowerCase().includes(s);
    });
  }, [conversations, q]);

  function handleSelectConversation(nextId: number) {
    if (selected && selected.id !== nextId && !isMandatoryStatus(selected.status)) {
      toast.error('Vous devez choisir un statut obligatoire avant de quitter cette conversation.');
      return;
    }
    setSelectedId(nextId);
    setOpenedAtByConversation((prev) => ({ ...prev, [nextId]: Date.now() }));
  }

  async function updateConversationStatus(nextStatus: string) {
    if (!selectedId) return;
    setStatusSaving(true);
    const res = await api.patch<ApiConversation>(`conversations/${selectedId}`, { status: nextStatus });
    setStatusSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setConversations((prev) => prev.map((c) => (c.id === selectedId ? { ...c, status: nextStatus } : c)));
    toast.success('Statut conversation mis a jour.');
  }

  async function send() {
    if (!selectedId || !draft.trim()) return;
    const res = await api.post(`conversations/${selectedId}/messages`, {
      direction: 'outbound',
      content: draft.trim(),
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setDraft('');
    await loadMessages(selectedId);
    await loadConversations();
  }

  useEffect(() => {
    if (!newOpen) return;
    void (async () => {
      let list = templates;
      if (!list.length) {
        const res = await api.get<WaTemplate[]>('whatsapp/templates');
        list = res.ok ? res.data ?? [] : [];
        setTemplates(list);
      }
      setInitTemplate((prev) => prev || list.find((t) => t.name === 'contact_generique')?.name || list[0]?.name || '');
    })();
  }, [newOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openTemplatePicker() {
    setTemplatePickerOpen(true);
    setTemplatesLoading(true);
    setTemplatesError(null);
    const res = await api.get<WaTemplate[]>('whatsapp/templates');
    setTemplatesLoading(false);
    if (!res.ok) { setTemplatesError(res.message); return; }
    setTemplates(res.data ?? []);
    type ApiProd = { id: number; name: string; price: string; stock_quantity?: number; reserved_quantity?: number };
    const prod = await api.get<LaravelPaginator<ApiProd>>('products?per_page=200');
    if (prod.ok && isPaginator<ApiProd>(prod.data)) {
      setWaProducts(prod.data.data.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        stock: Math.max(0, (p.stock_quantity ?? 0) - (p.reserved_quantity ?? 0)),
      })));
    }
  }

  // Templates like "suivi commande" pair each product with its quantity
  // ({{2}} qty + {{3}} product, …), then the order total. An odd parameter
  // count means a last variable for the payment wording (COD vs déjà payée).
  const orderHasPayment = (selectedTemplate?.param_count ?? 0) % 2 === 1;
  const orderTemplateLines = selectedTemplate && selectedTemplate.param_count >= 4
    ? Math.floor((selectedTemplate.param_count - 2 - (orderHasPayment ? 1 : 0)) / 2)
    : 0;

  function openTemplateForSend(t: WaTemplate) {
    setSelectedTemplate(t);
    setOrderMode(t.param_count >= 4);
    setOrderLines([{ name: '', qty: '1' }]);
    setTemplateParams(guessTemplateParams(t, selected?.customer?.full_name ?? '', selected?.customer?.phone ?? ''));
  }

  const orderTotal = useMemo(() => orderLines.reduce((sum, l) => {
    const p = waProducts.find((x) => x.name.toLowerCase() === l.name.trim().toLowerCase());
    return sum + (p ? p.price * (Number(l.qty) || 0) : 0);
  }, 0), [orderLines, waProducts]);

  useEffect(() => {
    if (!orderMode || !selectedTemplate) return;
    const count = selectedTemplate.param_count;
    // Unused product slots stay empty here; the backend swaps them for a
    // zero-width space (Laravel trims invisible characters out of requests).
    const next = Array.from({ length: count }, () => '');
    next[0] = selected?.customer?.full_name ?? '';
    orderLines.slice(0, orderTemplateLines).forEach((l, i) => {
      if (!l.name.trim()) return;
      next[1 + 2 * i] = String(Number(l.qty) || 1);
      next[2 + 2 * i] = l.name.trim();
    });
    next[orderHasPayment ? count - 2 : count - 1] = formatCurrency(orderTotal);
    if (orderHasPayment) next[count - 1] = orderPrepaid ? 'تم الدفع مسبقا' : 'الدفع عند الإستلام';
    setTemplateParams(next);
  }, [orderMode, orderLines, orderTotal, orderTemplateLines, orderHasPayment, orderPrepaid, selectedTemplate, selected]);

  async function sendSelectedTemplate() {
    if (!selectedId || !selectedTemplate) return;
    // Refuse if any parameter is empty — WhatsApp rejects blank variables.
    if (!orderMode && selectedTemplate.param_count > 0 && templateParams.some((p) => !p.trim())) {
      toast.error('Remplissez toutes les variables du modèle.');
      return;
    }
    if (orderMode && !orderLines.some((l) => l.name.trim())) {
      toast.error('Choisissez au moins un produit.');
      return;
    }
    setSendingTemplate(true);
    // Pre-render the body with parameters so the chat bubble immediately
    // shows the real message instead of "[Modèle : name]" (avoids depending
    // on Meta's templates API for the local echo).
    // In mode commande, unused slots are empty on purpose: drop the marker
    // instead of printing "{{4}}" in the chat bubble.
    const previewBody = selectedTemplate.body
      ? templateParams
          .reduce(
            (acc, v, i) => acc.split(`{{${i + 1}}}`).join(v || (orderMode ? '' : `{{${i + 1}}}`)),
            selectedTemplate.body,
          )
          .replace(/^[ \t]+$/gm, '')
          .replace(/\n{3,}/g, '\n\n')
      : '';
    const res = await api.post(`conversations/${selectedId}/send-template`, {
      template_name: selectedTemplate.name,
      language_code: selectedTemplate.language,
      parameters: templateParams,
      preview_content: previewBody,
    });
    setSendingTemplate(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('Modèle envoyé.');
    setTemplatePickerOpen(false);
    setSelectedTemplate(null);
    setTemplateParams([]);
    await loadMessages(selectedId);
    await loadConversations();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    e.target.value = '';
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post(`conversations/${selectedId}/upload`, fd as any);
    setUploading(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    await loadMessages(selectedId);
    await loadConversations();
  }

  async function createConversation() {
    setNewError(null);

    if (numbers.length > 0 && !newNumberId) {
      setNewError('Veuillez choisir le numéro WhatsApp expéditeur.');
      return;
    }

    let customerId: number | null = null;

    if (newTab === 'new') {
      if (!newName.trim() || !newPhone.trim()) {
        setNewError('Veuillez remplir le nom et le numéro de téléphone.');
        return;
      }
      setCreatingCustomer(true);
      const custRes = await api.post<ApiCustomer>('customers', {
        full_name: newName.trim(),
        phone: newPhone.trim(),
        client_source: 'whatsapp',
        status: 'active',
      });
      setCreatingCustomer(false);
      if (!custRes.ok) {
        if ((custRes as { errors?: Record<string, unknown> }).errors?.phone) {
          // Already a client: jump to "Client existant" with that number searched.
          setNewTab('existing');
          setCustomerSearch(newPhone.trim());
          setNewError('Ce numéro existe déjà : sélectionnez le client ci-dessous.');
          return;
        }
        setNewError(custRes.message);
        return;
      }
      customerId = (custRes.data as any)?.id ?? null;
      if (!customerId) {
        setNewError('Erreur lors de la création du client.');
        return;
      }
    } else {
      if (!newCustomerId) return;
      customerId = Number(newCustomerId);
    }

    const res = await api.post<ApiConversation>('conversations', {
      customer_id: customerId,
      channel: 'whatsapp',
      status: 'open',
      assigned_user_id: user ? Number(user.id) : null,
      whatsapp_number_id: newNumberId ? Number(newNumberId) : undefined,
    });
    if (!res.ok) {
      setNewError(res.message);
      return;
    }

    const convId = (res.data as any)?.id;
    if (convId && initMode === 'template' && initTemplate) {
      const tpl = templates.find((t) => t.name === initTemplate);
      const sendRes = await api.post(`conversations/${convId}/send-template`, {
        template_name: initTemplate,
        language_code: tpl?.language ?? 'fr',
        parameters: tpl?.param_count
          ? Array.from({ length: tpl.param_count }, (_, i) => (i === 0 ? (newName.trim() || 'client') : ''))
          : [],
      });
      if (!sendRes.ok) {
        setNewError(sendRes.message);
      }
    }
    if (convId && initMode === 'free' && initText.trim()) {
      const msgRes = await api.post(`conversations/${convId}/messages`, {
        direction: 'outbound',
        content: initText.trim(),
      });
      if (!msgRes.ok) {
        setNewError(msgRes.message);
      }
    }

    toast.success('Conversation créée.');
    setNewOpen(false);
    setNewCustomerId('');
    setNewName('');
    setNewPhone('');
    setCustomerSearch('');
    setInitMode('template');
    setInitText('');
    setNewError(null);
    await loadConversations();
    if (convId) {
      setSelectedId(convId);
    }
  }

  const isAdmin = roleSlugs.includes('admin');
  const canDelete = hasPermission('conversations.delete') || isAdmin;

  // Load agents list for admin assignment
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const res = await api.get<LaravelPaginator<ApiUser>>('users?per_page=200');
      if (cancelled) return;
      if (res.ok && isPaginator<ApiUser>(res.data)) {
        const AGENT_ROLES = ['admin', 'confirmatrice'];
        const filtered = res.data.data.filter((u) => u.roles?.some((r) => AGENT_ROLES.includes(r.slug)) ?? false);
        setAgents(filtered);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  async function assignAgent(conversationId: number, userId: number | null) {
    setAssignSaving(true);
    const res = await api.patch<ApiConversation>(`conversations/${conversationId}`, { assigned_user_id: userId });
    setAssignSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    setConversations((prev) => prev.map((c) => c.id === conversationId ? { ...c, assigned_user_id: userId, assigned_user: agents.find((a) => a.id === userId) ?? null } : c));
    toast.success('Agent assigne.');
  }

  async function deleteMessage(msgId: number) {
    if (!selectedId || !confirm('Supprimer ce message ?')) return;
    const res = await api.del(`conversations/${selectedId}/messages/${msgId}`);
    if (!res.ok) { toast.error(res.message); return; }
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    toast.success('Message supprime.');
  }

  async function deleteConversation(cid: number) {
    if (!confirm('Supprimer cette conversation et tous ses messages ?')) return;
    const res = await api.del(`conversations/${cid}`);
    if (!res.ok) { toast.error(res.message); return; }
    setConversations((prev) => prev.filter((c) => c.id !== cid));
    if (selectedId === cid) { setSelectedId(null); setMessages([]); }
    toast.success('Conversation supprimee.');
  }

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque pour charger les conversations." />;
  }

  if (!canViewConversations) {
    return <EmptyState title="Accès refusé" description="Permission conversations.view requise." />;
  }

  return (
    <div className="space-y-3 min-h-0 pb-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-zinc-900">Conversations</h1>
          <p className="text-sm font-medium text-zinc-500 mt-1">Marque active: {activeBrand.name}</p>
        </div>
        {canCreateConversations ? (
          <button type="button" onClick={() => setNewOpen(true)} className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black shadow-md shadow-primary-100 hover:bg-primary-700">
            Nouvelle conversation
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-zinc-200/90 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:min-h-0 lg:h-[calc(100dvh-5rem)] lg:max-h-[calc(100dvh-5rem)] overflow-hidden">
          <aside className={cn(
            'lg:col-span-4 flex flex-col min-w-0 min-h-0 lg:h-full border-b lg:border-b-0 lg:border-r border-zinc-100/90 bg-zinc-50/30',
            // On mobile: hide the conversation list while a conversation is open,
            // so the messages panel takes the full width instead of appearing below.
            selectedId != null && 'hidden lg:flex',
          )}>
            <div className="p-5 sm:p-6 border-b border-zinc-100/90 space-y-4 shrink-0">
              {numbers.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setNumberFilter(''); setSelectedId(null); setMessages([]); }}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition',
                      numberFilter === '' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50',
                    )}
                  >
                    Tous
                  </button>
                  {numbers.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => { setNumberFilter(String(n.id)); setSelectedId(null); setMessages([]); }}
                      title={waNumberLabel(n)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wide border transition max-w-[10rem] truncate',
                        numberFilter === String(n.id) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50',
                      )}
                    >
                      {waNumberLabel(n)}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary-500 font-medium shadow-sm"
                  placeholder="Rechercher…"
                />
              </div>
              {isAdmin && agents.length > 0 && (
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold shadow-sm"
                >
                  <option value="">Tous les agents</option>
                  {agents.map((a) => (
                    <option key={a.id} value={String(a.id)}>{a.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-zinc-100/80">
              {loading ? (
                <div className="p-8 text-center text-sm font-bold text-zinc-500">Chargement…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-sm font-bold text-zinc-500">Aucune conversation</div>
              ) : (
                filtered.map((c) => {
                  const name = c.customer?.full_name ?? `Conversation #${c.id}`;
                  const phone = c.customer?.phone ?? '';
                  const ts = c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectConversation(c.id)}
                      className={cn(
                        'w-full text-left p-5 sm:p-6 flex gap-4 hover:bg-white/80 transition-colors relative group',
                        selectedId === c.id && 'bg-primary-50/80',
                      )}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center justify-center font-black text-zinc-500 shrink-0">
                        {name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-zinc-900 truncate">{name}</p>
                            {c.brand?.name && <p className="text-[10px] font-bold text-zinc-400 truncate">{c.brand.name}</p>}
                            {numbers.length > 1 && numberFilter === '' && c.whatsapp_number && (
                              <p className="text-[10px] font-bold text-primary-500 truncate">{waNumberLabel(c.whatsapp_number)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <p className={cn('text-[10px] font-bold', c.unread_count ? 'text-primary-600' : 'text-zinc-400')}>{ts}</p>
                            {canDelete && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); void deleteConversation(c.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-100" title="Supprimer la conversation">
                                <Trash2 className="w-3.5 h-3.5 text-rose-400 hover:text-rose-600" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={cn('text-[12px] truncate', c.unread_count ? 'font-bold text-zinc-800' : 'font-medium text-zinc-500')}>
                            {c.last_message_direction === 'outbound' && (() => {
                              const st = c.last_message_status ?? null;
                              if (st === 'failed') return <span className="mr-1 text-[10px] font-black text-rose-600 uppercase" title="Échec d’envoi">Échec</span>;
                              if (st === 'read') return <CheckCircle2 className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-primary-500" aria-label="Lu" />;
                              if (st === 'delivered') return <CheckCircle2 className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-zinc-500" aria-label="Reçu" />;
                              if (st === 'sent') return <CheckCircle2 className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-zinc-300" aria-label="Envoyé" />;
                              return <Clock className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5 text-amber-500" aria-label="En attente d’envoi" />;
                            })()}
                            {c.last_message_content ? (c.last_message_content.length > 40 ? c.last_message_content.slice(0, 40) + '...' : c.last_message_content) : phone || 'Aucun message'}
                          </p>
                          {(c.unread_count ?? 0) > 0 && (
                            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-black flex items-center justify-center">
                              {c.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedId === c.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className={cn(
            'lg:col-span-8 flex flex-col min-w-0 min-h-[420px] lg:min-h-0 lg:h-full lg:max-h-full overflow-hidden bg-white',
            // On mobile: only render the messages panel when a conversation is selected.
            selectedId == null && 'hidden lg:flex',
          )}>
            {selected ? (
              <>
                <div className="px-5 sm:px-7 py-3 border-b border-zinc-100/90 shrink-0 bg-white">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden inline-flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg hover:bg-zinc-100 text-zinc-600 text-xs font-bold"
                    aria-label="Retour à la liste"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Retour aux conversations
                  </button>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                    <p className="text-base font-black text-zinc-900 truncate">{selected.customer?.full_name ?? `Conversation #${selected.id}`}</p>
                      <p className="text-xs font-bold text-zinc-500 truncate mt-1">{selected.customer?.phone ?? ''}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusChip tone={isMandatoryStatus(selected.status) ? 'success' : 'danger'}>
                          {isMandatoryStatus(selected.status) ? 'Statut valide' : 'Statut obligatoire'}
                        </StatusChip>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">Agent :</span>
                            <select
                              value={selected.assigned_user_id ?? ''}
                              disabled={assignSaving}
                              onChange={(e) => void assignAgent(selected.id, e.target.value ? Number(e.target.value) : null)}
                              className="px-2 py-1 rounded-lg border border-zinc-200 text-[11px] font-bold bg-white text-zinc-700"
                            >
                              <option value="">— Non assigne —</option>
                              {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        {!isAdmin && selected.assigned_user && (
                          <StatusChip tone="info">{selected.assigned_user.name}</StatusChip>
                        )}
                        {selected.needs_reply_alert ? <StatusChip tone="warning">Reponse en retard</StatusChip> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={selected.status}
                        disabled={statusSaving}
                        onChange={(e) => void updateConversationStatus(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-zinc-200 text-xs font-black uppercase tracking-wide bg-white"
                      >
                        <option value="open">-- Choisir statut --</option>
                        {!['open', ...CONVERSATION_STATUS_OPTIONS.map((o) => o.value)].includes(selected.status) ? (
                          <option value={selected.status}>{selected.status}</option>
                        ) : null}
                        {CONVERSATION_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {selected.lead && (
                        <button
                          type="button"
                          onClick={() => {
                            onCreateOrderFromLead({
                              leadId: selected.lead!.id,
                              customerName: selected.customer?.full_name ?? '',
                              phone: selected.customer?.phone ?? '',
                              source: 'WhatsApp',
                            });
                            trackSession({ name: 'audit.whatsapp.order_prefill', ts: Date.now(), meta: { conversationId: selected.id } });
                          }}
                          className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black text-zinc-700 hover:bg-zinc-50 shrink-0"
                        >
                          Vers commande
                        </button>
                      )}
                    </div>
                  </div>
                  {selected.is_waiting_agent_reply ? (
                    <p className="text-xs font-bold text-amber-700 mt-3">
                      Client en attente depuis {(() => { const m = selected.waiting_agent_reply_minutes ?? 0; if (m < 1) return `${Math.round(m * 60)}s`; if (m < 60) return `${Math.round(m)} min`; return `${Math.floor(m / 60)}h ${Math.round(m % 60)} min`; })()} sans reponse agent.
                    </p>
                  ) : null}
                  {(() => {
                    // WhatsApp Cloud only accepts free-form text within 24h of
                    // the customer's last inbound. Outside that window, only
                    // approved templates go through — warn the agent up front
                    // so they don't fire "Échec" bubbles.
                    const lastInbound = messages.reduce<number>((acc, m) => {
                      if (m.direction !== 'inbound') return acc;
                      const t = m.sent_at ? new Date(m.sent_at).getTime() : 0;
                      return t > acc ? t : acc;
                    }, 0);
                    if (!lastInbound) return null;
                    const hoursSince = (Date.now() - lastInbound) / 3_600_000;
                    if (hoursSince < 24) return null;
                    return (
                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        <span className="font-black">Fenêtre 24 h expirée.</span> Le dernier message du client date de plus de 24 h : les messages libres seront refusés par WhatsApp. Envoyez un modèle approuvé, ou attendez que le client vous écrive.
                      </div>
                    );
                  })()}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-7 py-4 space-y-4 bg-gradient-to-b from-zinc-50/50 to-white">
                  {msgLoading ? (
                    <p className="text-sm font-bold text-zinc-500">Chargement messages…</p>
                  ) : (
                    messages.map((m, idx) => {
                      const isAgent = m.direction === 'outbound';
                      const ts = m.sent_at ? new Date(m.sent_at).getTime() : Date.now();
                      const prev = idx > 0 ? messages[idx - 1] : null;
                      const prevTs = prev?.sent_at ? new Date(prev.sent_at).getTime() : null;
                      const showDayDivider = prevTs === null || !isSameDay(new Date(prevTs), new Date(ts));
                      return (
                        <Fragment key={m.id}>
                          {showDayDivider && (
                            <div className="flex justify-center py-1">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-full px-3 py-1">
                                {formatDayDivider(new Date(ts))}
                              </span>
                            </div>
                          )}
                        <div className={cn('flex gap-3 max-w-[min(92%,28rem)] group/msg', isAgent ? 'flex-row-reverse ml-auto' : '')}>
                          {!isAgent && (
                            <div className="w-8 h-8 rounded-xl bg-zinc-200 shrink-0 flex items-center justify-center text-[10px] font-black text-zinc-600">
                              {(selected.customer?.full_name ?? '?')[0]}
                            </div>
                          )}
                          <div className="space-y-1 min-w-0">
                            <div
                              className={cn(
                                'px-4 py-3 rounded-2xl border shadow-sm',
                                isAgent
                                  ? 'bg-primary-600 text-white border-primary-600/20 rounded-tr-none shadow-primary-100'
                                  : 'bg-white text-zinc-800 border-zinc-100 rounded-tl-none',
                              )}
                            >
                              {m.message_type === 'audio' && m.media_url ? (
                                <div className="space-y-2">
                                  <audio controls preload="metadata" src={`${window.location.origin}${m.media_url}`} className="w-64 max-w-full" />
                                  {m.content && <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>}
                                </div>
                              ) : m.message_type === 'video' && m.media_url ? (
                                <div className="space-y-2">
                                  <video controls preload="metadata" src={`${window.location.origin}${m.media_url}`} className="max-w-[260px] rounded-xl" />
                                  {m.content && <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>}
                                </div>
                              ) : (m.message_type === 'image' || m.message_type === 'sticker') && m.media_url ? (
                                <div className="space-y-2">
                                  <a href={`${window.location.origin}${m.media_url}`} target="_blank" rel="noopener noreferrer">
                                    <img src={`${window.location.origin}${m.media_url}`} alt="" className="max-w-[240px] rounded-xl" />
                                  </a>
                                  {m.content && <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>}
                                </div>
                              ) : m.message_type === 'document' && m.media_url ? (
                                <div className="space-y-2">
                                  <a
                                    href={`${window.location.origin}${m.media_url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold',
                                      isAgent ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700',
                                    )}
                                  >
                                    <FileText className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{m.media_url.split('/').pop() ?? 'Document'}</span>
                                  </a>
                                  {m.content && <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content}</p>}
                                </div>
                              ) : (
                                <p dir="auto" className="text-sm leading-relaxed break-words whitespace-pre-wrap">{m.content ?? '—'}</p>
                              )}
                            </div>
                            {isAgent && m.delivery_status === 'failed' && m.delivery_error && (
                              <div className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[11px] leading-snug text-rose-800 font-medium">
                                <span className="font-black">Échec WhatsApp :</span> {m.delivery_error}
                              </div>
                            )}
                            <div className={cn('flex items-center gap-1', isAgent ? 'justify-end' : '')}>
                              <span className="text-[10px] text-zinc-400 font-bold">
                                {new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {isAgent && (() => {
                                const s = m.delivery_status ?? null;
                                if (s === 'failed') return (
                                  <button
                                    type="button"
                                    onClick={() => alert(
                                      m.delivery_error
                                        ? `Cause de l'échec :\n\n${m.delivery_error}`
                                        : "Échec sans motif renvoyé par Meta.\n\nCauses fréquentes :\n• Numéro du client incorrect ou bloqué\n• Fenêtre 24h dépassée (le client n'a pas écrit depuis > 24h — utiliser un template)\n• Token Meta expiré / hors quota\n• Compte WhatsApp Business en pause"
                                    )}
                                    title="Cliquez pour voir la cause"
                                    className="text-[10px] font-black text-rose-600 uppercase tracking-wide underline decoration-dotted underline-offset-2 hover:text-rose-700"
                                  >
                                    Échec ⓘ
                                  </button>
                                );
                                if (s === 'read') return <CheckCircle2 className="w-3 h-3 text-primary-600" aria-label="Lu" />;
                                if (s === 'delivered') return <CheckCircle2 className="w-3 h-3 text-zinc-500" aria-label="Reçu" />;
                                if (s === 'sent') return <CheckCircle2 className="w-3 h-3 text-zinc-300" aria-label="Envoyé" />;
                                return <Clock className="w-3 h-3 text-amber-500" aria-label="En attente d'envoi" />;
                              })()}
                              {canDelete && (
                                <button type="button" onClick={() => void deleteMessage(m.id)} className="ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity p-0.5 rounded hover:bg-rose-100" title="Supprimer">
                                  <Trash2 className="w-3 h-3 text-rose-400 hover:text-rose-600" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        </Fragment>
                      );
                    })
                  )}
                </div>

                {presence.agent_typing && (
                  <p className="px-5 sm:px-7 pb-2 text-xs italic text-zinc-500 animate-pulse">
                    {presence.agent_typing.name} est en train d'écrire…
                  </p>
                )}

                {canCreateConversations && (
                  <div className="p-4 border-t border-zinc-100 bg-white shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="relative" ref={emojiRef}>
                        <button type="button" onClick={() => setEmojiOpen((p) => !p)} className="p-3 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50" aria-label="emoji">
                          <Smile className="w-5 h-5" />
                        </button>
                        {emojiOpen && (
                          <div className="absolute bottom-14 left-0 z-50 bg-white rounded-xl shadow-2xl border border-zinc-200 p-3 w-[280px]">
                            <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto">
                              {['😀','😂','😍','🥰','😎','🤔','👍','👏','🎉','❤️','🔥','✅','⭐','💯','🙏','😊','😢','😡','🤝','💪','📦','🚚','💰','📞','✉️','⏰','🔔','📝','🎁','🛒','📊','🏷️','✨','🌟','💼','📱','🖊️','📋','🔑','🛡️'].map((e) => (
                                <button
                                  key={e}
                                  type="button"
                                  className="text-xl hover:bg-zinc-100 rounded-lg p-1 transition-colors"
                                  onClick={() => { setDraft((d) => d + e); setEmojiOpen(false); }}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                        onChange={(e) => void handleFileUpload(e)}
                      />
                      <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-50" aria-label="attach">
                        <Paperclip className={`w-5 h-5 ${uploading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void openTemplatePicker()}
                        title="Envoyer un modèle approuvé (permet de contacter un client hors fenêtre 24h)"
                        className="p-3 rounded-xl border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"
                        aria-label="template"
                      >
                        <MessageSquare className="w-5 h-5" />
                      </button>
                      <textarea
                        value={draft}
                        onChange={(e) => { setDraft(e.target.value); if (e.target.value.trim()) pingTyping(); }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' || e.shiftKey) return;
                          e.preventDefault();
                          void send();
                        }}
                        rows={1}
                        className="flex-1 h-11 px-4 py-2.5 rounded-2xl border border-zinc-200 text-sm font-medium outline-none focus:ring-2 focus:ring-primary-500 resize-none leading-6"
                        placeholder="Message…"
                      />
                      <button
                        type="button"
                        onClick={() => void send()}
                        className="p-3 rounded-2xl bg-primary-600 text-white hover:bg-primary-700 shadow-md shadow-primary-100"
                        aria-label="send"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-10 gap-3">
                <MessageSquare className="w-10 h-10 opacity-40" />
                <p className="text-sm font-black">Sélectionnez une conversation</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal
        open={newOpen}
        onClose={() => { setNewOpen(false); setCustomerSearch(''); setNewName(''); setNewPhone(''); setNewCustomerId(''); setNewError(null); }}
        title="Nouvelle conversation"
        subtitle={newTab === 'existing' ? 'Sélectionnez un client existant.' : 'Ajoutez un nouveau contact.'}
        footer={
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => { setNewOpen(false); setCustomerSearch(''); setNewName(''); setNewPhone(''); setNewCustomerId(''); }} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black text-zinc-700">
              Annuler
            </button>
            <button
              type="button"
              disabled={newTab === 'existing' ? !newCustomerId : (!newName.trim() || !newPhone.trim()) || creatingCustomer}
              onClick={() => void createConversation()}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black disabled:opacity-50"
            >
              {creatingCustomer ? 'Création…' : 'Créer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {newError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-700">
              {newError}
            </div>
          )}
          <div className="flex rounded-xl border border-zinc-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setNewTab('existing')}
              className={cn('flex-1 px-4 py-2.5 text-xs font-black transition-colors', newTab === 'existing' ? 'bg-primary-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50')}
            >
              Client existant
            </button>
            <button
              type="button"
              onClick={() => setNewTab('new')}
              className={cn('flex-1 px-4 py-2.5 text-xs font-black transition-colors', newTab === 'new' ? 'bg-primary-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-50')}
            >
              Nouveau contact
            </button>
          </div>

          {newTab === 'existing' ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Rechercher un client</label>
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Nom ou numéro…"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-zinc-800 text-sm"
              />
              <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-100">
                {customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setNewCustomerId(String(c.id))}
                      className={cn(
                        'w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-b-0',
                        newCustomerId === String(c.id) && 'bg-primary-50 border-primary-100',
                      )}
                    >
                      <div>
                        <p className={cn('text-sm font-bold', newCustomerId === String(c.id) ? 'text-primary-700' : 'text-zinc-800')}>{c.full_name}</p>
                        <p className="text-xs text-zinc-400">{c.phone}</p>
                      </div>
                      {newCustomerId === String(c.id) && <CheckCircle2 size={16} className="text-primary-600 shrink-0" />}
                    </button>
                  ))}
                {customers.length === 0 && (
                  <p className="text-xs text-zinc-400 p-4 text-center">Aucun client trouvé.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Nom complet</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Ahmed Benali"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-zinc-800 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Numéro de téléphone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Ex: 0600000000"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-zinc-800 text-sm"
                />
              </div>
            </div>
          )}

          {numbers.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Numéro WhatsApp expéditeur</label>
              <select value={newNumberId} onChange={(e) => setNewNumberId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-zinc-200 font-bold text-zinc-800">
                {numbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {waNumberLabel(n)}{n.is_default ? ' (par défaut)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-800">Premier message</p>
            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <input type="radio" name="init-mode" checked={initMode === 'template'} onChange={() => setInitMode('template')} className="accent-emerald-600" />
              Envoyer un modèle
            </label>
            {initMode === 'template' && (
              <select
                value={initTemplate}
                onChange={(e) => setInitTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm font-semibold text-zinc-900"
              >
                {templates.length === 0 && <option value="">Aucun modèle disponible</option>}
                {templates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <input type="radio" name="init-mode" checked={initMode === 'free'} onChange={() => setInitMode('free')} className="accent-emerald-600" />
              Message libre
            </label>
            {initMode === 'free' && (
              <>
                <textarea
                  rows={3}
                  dir="auto"
                  value={initText}
                  onChange={(e) => setInitText(e.target.value)}
                  placeholder="Votre message…"
                  className="w-full px-3 py-2 rounded-xl border border-emerald-200 bg-white text-sm text-zinc-900"
                />
                <p className="text-[10px] text-emerald-700">WhatsApp n’accepte un message libre que si le client a écrit dans les 24 h. Sinon, utilisez un modèle.</p>
              </>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
              <input type="radio" name="init-mode" checked={initMode === 'none'} onChange={() => setInitMode('none')} className="accent-emerald-600" />
              Ne rien envoyer
            </label>
          </div>
        </div>
      </Modal>

      {templatePickerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {!selectedTemplate ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-zinc-900">Envoyer un modèle</h2>
                  <button onClick={() => setTemplatePickerOpen(false)} className="p-1 rounded-lg hover:bg-zinc-100"><ArrowLeft className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-zinc-500">
                  Seuls les modèles <strong>APPROVED</strong> par Meta sont listés ici. Un modèle vous permet d'écrire à un client hors fenêtre 24h.
                </p>
                {templatesLoading ? (
                  <p className="text-sm text-zinc-400 text-center py-6">Chargement…</p>
                ) : templatesError ? (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
                    {templatesError}
                  </div>
                ) : templates.length === 0 ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                    Aucun modèle approuvé.<br />
                    Créez-en un dans <strong>Meta Business Suite → WhatsApp → Message templates</strong>, attendez son approbation (~24h), puis revenez ici.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <button
                        key={`${t.name}-${t.language}`}
                        onClick={() => openTemplateForSend(t)}
                        className="w-full text-left rounded-xl border border-zinc-200 p-3 hover:border-primary-400 hover:bg-primary-50/40 transition"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-black text-zinc-900">{t.name}</span>
                          <span className="text-[10px] font-bold uppercase rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-600">{TEMPLATE_CATEGORY_FR[t.category?.toUpperCase()] ?? t.category}</span>
                          <span className="text-[10px] font-semibold text-zinc-400">{t.language}</span>
                          {t.param_count > 0 && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
                              {t.param_count} variable{t.param_count > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p dir="auto" className="text-xs text-zinc-600 whitespace-pre-wrap line-clamp-3">
                          {renderTemplatePreview(t.body, guessTemplateParams(t, selected?.customer?.full_name ?? '', selected?.customer?.phone ?? ''))}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-zinc-900">{selectedTemplate.name}</h2>
                  <button onClick={() => { setSelectedTemplate(null); setTemplateParams([]); }} className="p-1 rounded-lg hover:bg-zinc-100"><ArrowLeft className="w-4 h-4" /></button>
                </div>
                <div dir="auto" className="rounded-xl bg-zinc-50 border border-zinc-200 p-3 text-sm whitespace-pre-wrap">
                  {selectedTemplate.body ? renderTemplatePreview(selectedTemplate.body, templateParams, orderMode) : <em>(pas de corps)</em>}
                </div>
                {orderTemplateLines > 0 && (
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-700">
                    <input type="checkbox" checked={orderMode} onChange={(e) => setOrderMode(e.target.checked)} />
                    Mode commande (produits + total calculé)
                  </label>
                )}
                {orderMode ? (
                  <div className="space-y-3">
                    {orderLines.slice(0, orderTemplateLines).map((l, i) => {
                      const product = waProducts.find((x) => x.name.toLowerCase() === l.name.trim().toLowerCase());
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex gap-2">
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-xs font-bold text-zinc-700">Produit {i + 1}</p>
                              <ProductCombo
                                products={waProducts}
                                value={l.name}
                                onChange={(v) => setOrderLines((prev) => prev.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <p className="text-xs font-bold text-zinc-700">Qté</p>
                              <input
                                type="number"
                                min={1}
                                value={l.qty}
                                onChange={(e) => setOrderLines((prev) => prev.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                                className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-900"
                              />
                            </div>
                            <div className="w-9 flex items-end">
                              {orderLines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setOrderLines((prev) => prev.filter((_, j) => j !== i))}
                                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
                                  aria-label="Retirer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          {product ? (
                            <p className={`text-[11px] font-semibold ${product.stock < (Number(l.qty) || 0) ? 'text-rose-600' : 'text-zinc-500'}`}>
                              {formatCurrency(product.price)} l’unité · {formatCurrency(product.price * (Number(l.qty) || 0))} ·{' '}
                              {product.stock <= 0
                                ? 'Rupture de stock'
                                : product.stock < (Number(l.qty) || 0)
                                  ? `Stock insuffisant : ${product.stock} disponible(s)`
                                  : `${product.stock} en stock`}
                            </p>
                          ) : (
                            <p className="text-[11px] font-semibold text-zinc-500">
                              {l.name.trim() ? 'Produit inconnu — prix non compté' : 'Choisissez un produit dans la liste'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {orderHasPayment && (
                      <div className="flex flex-wrap gap-4 rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-800">
                          <input type="radio" name="order-paid" checked={!orderPrepaid} onChange={() => setOrderPrepaid(false)} />
                          Paiement à la livraison
                        </label>
                        <label className="flex items-center gap-2 text-xs font-bold text-zinc-800">
                          <input type="radio" name="order-paid" checked={orderPrepaid} onChange={() => setOrderPrepaid(true)} />
                          Déjà payée
                        </label>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      {orderLines.length < orderTemplateLines ? (
                        <button
                          type="button"
                          onClick={() => setOrderLines((prev) => [...prev, { name: '', qty: '1' }])}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-black text-zinc-700 hover:bg-zinc-50"
                        >
                          + Ajouter un produit
                        </button>
                      ) : <span className="text-[11px] text-zinc-400">Maximum {orderTemplateLines} produits pour ce modèle.</span>}
                      <p className="text-sm font-black text-zinc-900">Total : {formatCurrency(orderTotal)}</p>
                    </div>
                  </div>
                ) : templateParams.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-zinc-700">Variables du modèle (modifiables) :</p>
                    {templateParams.map((val, idx) => {
                      const marker = `{{${idx + 1}}}`;
                      const before = selectedTemplate.body.split(marker)[0]?.split(/\s+/).slice(-3).join(' ') ?? '';
                      return (
                        <label key={idx} className="block text-xs font-semibold text-zinc-600">
                          <span className="font-black text-zinc-400">{marker}</span> {before ? `${before}…` : ''}
                          <input
                            value={val}
                            onChange={(e) => setTemplateParams((prev) => { const next = [...prev]; next[idx] = e.target.value; return next; })}
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm ${val.trim() ? 'border-zinc-200' : 'border-amber-300 bg-amber-50'}`}
                            dir="auto"
                            placeholder="Valeur…"
                            autoFocus={idx === templateParams.findIndex((v) => !v.trim())}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                  <button onClick={() => { setSelectedTemplate(null); setTemplateParams([]); }} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-bold">Retour</button>
                  <button
                    disabled={sendingTemplate}
                    onClick={() => void sendSelectedTemplate()}
                    className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-50"
                  >
                    {sendingTemplate ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Product picker: click to see the list, type to filter it. */
function ProductCombo({
  products,
  value,
  onChange,
}: {
  products: { id: number; name: string; price: number; stock: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const shown = query.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : products;
  const known = products.some((p) => p.name.toLowerCase() === value.trim().toLowerCase());

  return (
    <div ref={boxRef} className="relative">
      <input
        value={open ? query : value}
        onFocus={() => { setQuery(''); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        placeholder="Choisir ou rechercher un produit…"
        className={`w-full px-3 py-2 rounded-xl border text-sm font-semibold text-zinc-900 ${known || !value.trim() ? 'border-zinc-200' : 'border-amber-300 bg-amber-50'}`}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {shown.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-500">Aucun produit.</p>
          ) : shown.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.name); setOpen(false); }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span className="truncate font-semibold text-zinc-900">{p.name}</span>
              <span className="shrink-0 text-xs font-bold text-zinc-500">
                {formatCurrency(p.price)} ·{' '}
                <span className={p.stock <= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {p.stock <= 0 ? 'rupture' : `${p.stock} en stock`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Guess auto-fill values for a template's {{N}} placeholders based on the
 * customer's name + phone. {{1}} defaults to the full name; other
 * variables stay empty for the agent. Nearby keywords in the template body
 * override this — e.g. "téléphone {{2}}" pulls the phone number instead.
 */
function guessTemplateParams(t: { body: string; param_count: number }, fullName: string, phone: string): string[] {
  const name = (fullName ?? '').trim();
  const ph = (phone ?? '').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? '';
  const body = t.body.toLowerCase();

  return Array.from({ length: t.param_count }).map((_, idx) => {
    const marker = `{{${idx + 1}}}`;
    const pos = body.indexOf(marker);
    const window = pos >= 0 ? body.slice(Math.max(0, pos - 40), pos + 40) : '';
    if (/tél|téléphone|phone|numéro/.test(window)) return ph;
    if (/commande|order|référence|ref\b|n°/.test(window)) return '';
    if (/prénom|first ?name/.test(window)) return firstName;
    if (/nom complet|full ?name/.test(window)) return name;
    if (idx === 0) return name;
    return '';
  });
}

/**
 * Render a template body with {{N}} replaced by the corresponding value
 * from `values`. Empty values fall back to a highlighted placeholder so
 * the agent still sees where the gap is in the preview.
 */
function renderTemplatePreview(body: string, values: string[], hideEmpty = false): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\{\{(\d+)\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(body)) !== null) {
    if (m.index > lastIndex) parts.push(body.slice(lastIndex, m.index));
    const idx = parseInt(m[1], 10) - 1;
    const v = values[idx];
    if (v && v.trim()) {
      parts.push(<strong key={`f-${key++}`} className="font-black">{v}</strong>);
    } else if (!hideEmpty) {
      parts.push(<span key={`b-${key++}`} className="italic text-amber-700">[{`{{${idx + 1}}}`}]</span>);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return <>{parts}</>;
}
