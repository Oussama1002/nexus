import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Link2,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';
import { useAuth } from '../context/AuthContext';
import { flattenFieldErrors } from '../lib/formErrors';
import { buildQuery } from '../lib/pagination';
import * as api from '../lib/api';

/* ──────────── Types ──────────── */

type CourseStatus = 'draft' | 'published' | 'archived';
type EnrollmentType = 'free' | 'paid';
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
type LessonType = 'video' | 'pdf' | 'text' | 'external_link';
type Tab = 'courses' | 'detail' | 'students' | 'enrollments' | 'quizzes';

type AcademyCourse = {
  id: number;
  uuid: string;
  brand_id: number;
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  status: CourseStatus;
  enrollment_type: EnrollmentType;
  price: string | number;
  currency: string;
  duration_minutes: number;
  difficulty_level: DifficultyLevel;
  category?: { id: number; name: string; slug: string } | null;
  sections_count?: number;
  lessons_count?: number;
  enrollments_count?: number;
  created_at: string;
};

type Section = {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  lessons_count?: number;
};

type Lesson = {
  id: number;
  course_id: number;
  course_section_id: number;
  title: string;
  lesson_type: LessonType;
  content: string | null;
  video_url: string | null;
  pdf_url: string | null;
  external_url: string | null;
  duration_minutes: number;
  sort_order: number;
  is_preview: boolean;
  is_published: boolean;
  section?: { id: number; title: string } | null;
};

type StudentRow = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  status: string;
  user_id: number | null;
  enrollments_count?: number;
  certificates_count?: number;
};

type EnrollmentRow = {
  id: number;
  course_id: number;
  student_id: number;
  status: string;
  enrollment_type: string;
  progress_percent: number;
  enrolled_at: string | null;
  completed_at: string | null;
  course?: { id: number; title: string } | null;
  student?: { id: number; full_name: string; email: string } | null;
};

type QuizRow = {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  passing_score: number;
  max_attempts: number;
  is_active: boolean;
  questions_count?: number;
  attempts_count?: number;
};

type CourseDraft = {
  title: string;
  slug: string;
  short_description: string;
  description: string;
  status: CourseStatus;
  enrollment_type: EnrollmentType;
  price: string;
  currency: string;
  duration_minutes: string;
  difficulty_level: DifficultyLevel;
  learning_objectives: string;
  prerequisites: string;
};

/* ──────────── Constants ──────────── */

const STATUS_LABELS: Record<string, string> = { draft: 'Brouillon', published: 'Publié', archived: 'Archivé' };
const DIFFICULTY_LABELS: Record<string, string> = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' };
const ENROLLMENT_STATUS_LABELS: Record<string, string> = { pending: 'En attente', active: 'Actif', completed: 'Terminé', expired: 'Expiré', cancelled: 'Annulé' };
const LESSON_TYPE_LABELS: Record<string, string> = { video: 'Vidéo', pdf: 'PDF', text: 'Texte', external_link: 'Lien externe' };
const LESSON_TYPE_ICONS: Record<string, React.ReactNode> = {
  video: <Video className="w-4 h-4 text-blue-600" />,
  pdf: <FileText className="w-4 h-4 text-rose-600" />,
  text: <BookOpen className="w-4 h-4 text-amber-600" />,
  external_link: <Link2 className="w-4 h-4 text-emerald-600" />,
};

const defaultDraft: CourseDraft = {
  title: '', slug: '', short_description: '', description: '', status: 'draft',
  enrollment_type: 'free', price: '0', currency: 'MAD', duration_minutes: '0',
  difficulty_level: 'beginner', learning_objectives: '', prerequisites: '',
};

/* ──────────── Helpers ──────────── */

function slugify(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
}

function parseRows<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== 'object') return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p)) return p as T[];
  if (Array.isArray(p.data)) return p.data as T[];
  if (p.data && typeof p.data === 'object') {
    const inner = p.data as Record<string, unknown>;
    if (Array.isArray(inner.data)) return inner.data as T[];
  }
  return [];
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'published' || status === 'active' || status === 'completed') return 'success';
  if (status === 'archived' || status === 'expired' || status === 'cancelled') return 'neutral';
  if (status === 'pending') return 'info';
  return 'warning';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function courseToDraft(course: AcademyCourse): CourseDraft {
  return {
    title: course.title, slug: course.slug,
    short_description: course.short_description ?? '', description: course.description ?? '',
    status: course.status, enrollment_type: course.enrollment_type,
    price: String(course.price ?? 0), currency: course.currency ?? 'MAD',
    duration_minutes: String(course.duration_minutes ?? 0),
    difficulty_level: course.difficulty_level ?? 'beginner',
    learning_objectives: '', prerequisites: '',
  };
}

function draftToPayload(draft: CourseDraft): Record<string, unknown> {
  const lo = draft.learning_objectives.split('\n').map((v) => v.trim()).filter(Boolean);
  const pr = draft.prerequisites.split('\n').map((v) => v.trim()).filter(Boolean);
  return {
    title: draft.title.trim(), slug: draft.slug.trim(),
    short_description: draft.short_description.trim() || null,
    description: draft.description.trim() || null, status: draft.status,
    enrollment_type: draft.enrollment_type,
    price: Number.isFinite(Number(draft.price)) ? Number(draft.price) : 0,
    currency: draft.currency.trim() || 'MAD',
    duration_minutes: Number.isFinite(Number(draft.duration_minutes)) ? Number(draft.duration_minutes) : 0,
    difficulty_level: draft.difficulty_level,
    learning_objectives: lo, prerequisites: pr,
  };
}

/* ──────────── Tab Button ──────────── */

function TabBtn({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl text-sm font-black inline-flex items-center gap-2 transition-colors ${
        active ? 'bg-primary-600 text-white shadow-md shadow-primary-100' : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ──────────── Main Component ──────────── */

export function AcademyScreen() {
  const toast = useToast();
  const qc = useQueryClient();
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();

  const [tab, setTab] = useState<Tab>('courses');
  const [selectedCourse, setSelectedCourse] = useState<AcademyCourse | null>(null);

  const canCreate = hasPermission(['academy_courses.create', 'hr.update']);
  const canUpdate = hasPermission(['academy_courses.update', 'hr.update']);
  const canDelete = hasPermission(['academy_courses.delete', 'hr.delete']);
  const canPublish = hasPermission(['academy_courses.publish', 'hr.update']);

  function openCourseDetail(course: AcademyCourse) {
    setSelectedCourse(course);
    setTab('detail');
  }

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque active pour accéder à l'académie." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Académie"
        subtitle="Formations, apprenants, inscriptions et évaluations."
      />

      <div className="flex items-center gap-2 flex-wrap">
        <TabBtn active={tab === 'courses'} label="Formations" icon={<GraduationCap className="w-4 h-4" />} onClick={() => setTab('courses')} />
        {selectedCourse && (
          <TabBtn active={tab === 'detail'} label={selectedCourse.title} icon={<BookOpen className="w-4 h-4" />} onClick={() => setTab('detail')} />
        )}
        <TabBtn active={tab === 'students'} label="Apprenants" icon={<Users className="w-4 h-4" />} onClick={() => setTab('students')} />
        <TabBtn active={tab === 'enrollments'} label="Inscriptions" icon={<ClipboardList className="w-4 h-4" />} onClick={() => setTab('enrollments')} />
        <TabBtn active={tab === 'quizzes'} label="Quiz" icon={<Play className="w-4 h-4" />} onClick={() => setTab('quizzes')} />
      </div>

      {tab === 'courses' && (
        <CoursesTab
          brandId={activeBrandId} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} canPublish={canPublish}
          onOpenDetail={openCourseDetail} toast={toast} qc={qc}
        />
      )}
      {tab === 'detail' && selectedCourse && (
        <CourseDetailTab
          course={selectedCourse} brandId={activeBrandId} canUpdate={canUpdate}
          onBack={() => setTab('courses')} toast={toast} qc={qc}
        />
      )}
      {tab === 'students' && <StudentsTab brandId={activeBrandId} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} toast={toast} qc={qc} />}
      {tab === 'enrollments' && <EnrollmentsTab brandId={activeBrandId} canCreate={canCreate} canDelete={canDelete} toast={toast} qc={qc} />}
      {tab === 'quizzes' && <QuizzesTab brandId={activeBrandId} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} toast={toast} qc={qc} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Formations (Courses)
   ══════════════════════════════════════════════════════ */

function CoursesTab({
  brandId, canCreate, canUpdate, canDelete, canPublish, onOpenDetail, toast, qc,
}: {
  brandId: string; canCreate: boolean; canUpdate: boolean; canDelete: boolean; canPublish: boolean;
  onOpenDetail: (c: AcademyCourse) => void; toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient>;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | CourseStatus>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AcademyCourse | null>(null);
  const [draft, setDraft] = useState<CourseDraft>(defaultDraft);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const queryKey = ['academy-courses', brandId, q, status];

  const coursesQuery = useQuery({
    queryKey, enabled: !!brandId,
    queryFn: async () => {
      const res = await api.get<unknown>(`academy/courses${buildQuery({ per_page: 200, search: q.trim() || undefined, status: status || undefined })}`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const rows = useMemo(() => parseRows<AcademyCourse>(coursesQuery.data), [coursesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (p: { id?: number; payload: Record<string, unknown> }) => {
      const res = p.id
        ? await api.patch<AcademyCourse>(`academy/courses/${p.id}`, p.payload)
        : await api.post<AcademyCourse>('academy/courses', p.payload);
      if (!res.ok) {
        const err = flattenFieldErrors(res.errors as Record<string, unknown>);
        const msgs = err.length > 0 ? err : [res.message];
        setFormErrors(msgs);
        throw new Error(msgs.join(' '));
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success(editingCourse ? 'Formation mise à jour.' : 'Formation créée.');
      setFormErrors([]); setModalOpen(false); setEditingCourse(null); setDraft(defaultDraft);
      void qc.invalidateQueries({ queryKey: ['academy-courses'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.del(`academy/courses/${id}`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Supprimée.'); void qc.invalidateQueries({ queryKey: ['academy-courses'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const publishMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.post(`academy/courses/${id}/publish`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Publiée.'); void qc.invalidateQueries({ queryKey: ['academy-courses'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterBar query={q} onQueryChange={setQ} right={
          <select value={status} onChange={(e) => setStatus((e.target.value as CourseStatus) || '')} className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold">
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        } />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void qc.invalidateQueries({ queryKey: ['academy-courses'] })} className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          {canCreate && (
            <button type="button" onClick={() => { setEditingCourse(null); setDraft(defaultDraft); setFormErrors([]); setModalOpen(true); }}
              className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nouvelle formation
            </button>
          )}
        </div>
      </div>

      {coursesQuery.isError ? (
        <EmptyState title="Échec du chargement" description={coursesQuery.error instanceof Error ? coursesQuery.error.message : 'Erreur'} />
      ) : rows.length === 0 && !coursesQuery.isLoading ? (
        <EmptyState title="Aucune formation" description="Créez votre première formation." />
      ) : (
        <DataTable<AcademyCourse> rows={rows} loading={coursesQuery.isLoading} columns={[
          { key: 'title', header: 'Formation', cell: (r) => (
            <button type="button" onClick={() => onOpenDetail(r)} className="text-left hover:underline">
              <p className="font-black text-zinc-900">{r.title}</p>
              <p className="text-xs text-zinc-500">{r.sections_count ?? 0} sections · {r.lessons_count ?? 0} leçons · {r.enrollments_count ?? 0} inscrits</p>
            </button>
          )},
          { key: 'status', header: 'Statut', cell: (r) => <StatusChip tone={statusTone(r.status)}>{STATUS_LABELS[r.status] ?? r.status}</StatusChip> },
          { key: 'difficulty', header: 'Niveau', cell: (r) => <span className="text-sm">{DIFFICULTY_LABELS[r.difficulty_level] ?? r.difficulty_level}</span> },
          { key: 'price', header: 'Prix', cell: (r) => <span className="text-sm font-bold">{Number(r.price).toFixed(2)} {r.currency}</span> },
          { key: 'actions', header: '', cell: (r) => (
            <div className="flex items-center gap-3">
              {canUpdate && <button type="button" onClick={() => { setEditingCourse(r); setDraft(courseToDraft(r)); setFormErrors([]); setModalOpen(true); }} className="text-sm font-black text-primary-600 hover:underline">Modifier</button>}
              {canPublish && r.status !== 'published' && <button type="button" onClick={() => publishMut.mutate(r.id)} className="text-sm font-black text-emerald-700 hover:underline inline-flex items-center gap-1"><Rocket className="w-3.5 h-3.5" />Publier</button>}
              {canDelete && <button type="button" onClick={() => { if (window.confirm(`Supprimer « ${r.title} » ?`)) deleteMut.mutate(r.id); }} className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Suppr.</button>}
            </div>
          )},
        ]} />
      )}

      {/* Course create/edit modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingCourse(null); setDraft(defaultDraft); }}
        title={editingCourse ? 'Modifier la formation' : 'Nouvelle formation'}
        subtitle="Tous les champs sont enregistrés via l'API."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setModalOpen(false); setEditingCourse(null); setDraft(defaultDraft); }} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
            <button type="button" onClick={() => {
              if (!draft.title.trim()) { toast.error('Le titre est requis.'); return; }
              saveMutation.mutate({ id: editingCourse?.id, payload: draftToPayload(draft) });
            }} disabled={saveMutation.isPending} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">
              {editingCourse ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {formErrors.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 space-y-1">{formErrors.map((e) => <p key={e}>{e}</p>)}</div>}
          <label className="block text-xs font-black uppercase text-zinc-500">Titre
            <input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value, slug: slugify(e.target.value) }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Titre de la formation" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Description courte
            <input value={draft.short_description} onChange={(e) => setDraft((d) => ({ ...d, short_description: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Description
            <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Statut
              <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as CourseStatus }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Archivé</option>
              </select>
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Inscription
              <select value={draft.enrollment_type} onChange={(e) => setDraft((d) => ({ ...d, enrollment_type: e.target.value as EnrollmentType }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value="free">Gratuite</option><option value="paid">Payante</option>
              </select>
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Niveau
              <select value={draft.difficulty_level} onChange={(e) => setDraft((d) => ({ ...d, difficulty_level: e.target.value as DifficultyLevel }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value="beginner">Débutant</option><option value="intermediate">Intermédiaire</option><option value="advanced">Avancé</option>
              </select>
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Durée (min)
              <input type="number" min={0} value={draft.duration_minutes} onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Prix
              <input type="number" min={0} step="0.01" value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Devise
              <input value={draft.currency} maxLength={3} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Course Detail (Sections + Lessons)
   ══════════════════════════════════════════════════════ */

function CourseDetailTab({
  course, brandId, canUpdate, onBack, toast, qc,
}: {
  course: AcademyCourse; brandId: string; canUpdate: boolean;
  onBack: () => void; toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient>;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [sectionModal, setSectionModal] = useState(false);
  const [lessonModal, setLessonModal] = useState(false);
  const [editSection, setEditSection] = useState<Section | null>(null);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [sectionTitle, setSectionTitle] = useState('');
  const [sectionDesc, setSectionDesc] = useState('');
  const [lessonDraft, setLessonDraft] = useState({ title: '', course_section_id: 0, lesson_type: 'text' as LessonType, content: '', video_url: '', pdf_url: '', external_url: '', duration_minutes: '0' });

  const sectionsQuery = useQuery({
    queryKey: ['academy-sections', course.id],
    queryFn: async () => {
      const res = await api.get<unknown>(`academy/courses/${course.id}/sections`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const lessonsQuery = useQuery({
    queryKey: ['academy-lessons', course.id],
    queryFn: async () => {
      const res = await api.get<unknown>(`academy/courses/${course.id}/lessons`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const sections = useMemo(() => parseRows<Section>(sectionsQuery.data), [sectionsQuery.data]);
  const lessons = useMemo(() => parseRows<Lesson>(lessonsQuery.data), [lessonsQuery.data]);

  const toggleSection = (id: number) => setExpandedSections((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const saveSectionMut = useMutation({
    mutationFn: async (p: { id?: number; title: string; description: string }) => {
      const res = p.id
        ? await api.put(`academy/courses/${course.id}/sections/${p.id}`, { title: p.title, description: p.description || null })
        : await api.post(`academy/courses/${course.id}/sections`, { title: p.title, description: p.description || null });
      if (!res.ok) throw new Error(res.message);
    },
    onSuccess: () => {
      toast.success('Section enregistrée.');
      setSectionModal(false); setEditSection(null); setSectionTitle(''); setSectionDesc('');
      void qc.invalidateQueries({ queryKey: ['academy-sections', course.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const deleteSectionMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.del(`academy/courses/${course.id}/sections/${id}`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Section supprimée.'); void qc.invalidateQueries({ queryKey: ['academy-sections', course.id] }); void qc.invalidateQueries({ queryKey: ['academy-lessons', course.id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const saveLessonMut = useMutation({
    mutationFn: async (p: { id?: number; data: Record<string, unknown> }) => {
      const res = p.id
        ? await api.put(`academy/courses/${course.id}/lessons/${p.id}`, p.data)
        : await api.post(`academy/courses/${course.id}/lessons`, p.data);
      if (!res.ok) { const err = flattenFieldErrors(res.errors as Record<string, unknown>); throw new Error(err.length > 0 ? err.join(' ') : res.message); }
    },
    onSuccess: () => {
      toast.success('Leçon enregistrée.');
      setLessonModal(false); setEditLesson(null);
      void qc.invalidateQueries({ queryKey: ['academy-lessons', course.id] });
      void qc.invalidateQueries({ queryKey: ['academy-sections', course.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const deleteLessonMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.del(`academy/courses/${course.id}/lessons/${id}`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Leçon supprimée.'); void qc.invalidateQueries({ queryKey: ['academy-lessons', course.id] }); void qc.invalidateQueries({ queryKey: ['academy-sections', course.id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  function openLessonCreate(sectionId: number) {
    setEditLesson(null);
    setLessonDraft({ title: '', course_section_id: sectionId, lesson_type: 'text', content: '', video_url: '', pdf_url: '', external_url: '', duration_minutes: '0' });
    setLessonModal(true);
  }

  function openLessonEdit(lesson: Lesson) {
    setEditLesson(lesson);
    setLessonDraft({
      title: lesson.title, course_section_id: lesson.course_section_id, lesson_type: lesson.lesson_type,
      content: lesson.content ?? '', video_url: lesson.video_url ?? '', pdf_url: lesson.pdf_url ?? '',
      external_url: lesson.external_url ?? '', duration_minutes: String(lesson.duration_minutes),
    });
    setLessonModal(true);
  }

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-black text-zinc-600 hover:text-zinc-900">
        <ArrowLeft className="w-4 h-4" /> Retour aux formations
      </button>

      <div className="card p-6 space-y-2">
        <h2 className="text-xl font-black text-zinc-900">{course.title}</h2>
        <p className="text-sm text-zinc-500">{course.short_description || course.description || '—'}</p>
        <div className="flex gap-4 text-xs font-bold text-zinc-500">
          <span>{STATUS_LABELS[course.status]}</span>
          <span>{DIFFICULTY_LABELS[course.difficulty_level]}</span>
          <span>{course.duration_minutes} min</span>
          <span>{Number(course.price).toFixed(2)} {course.currency}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-zinc-800">Sections & Leçons</h3>
        {canUpdate && (
          <button type="button" onClick={() => { setEditSection(null); setSectionTitle(''); setSectionDesc(''); setSectionModal(true); }}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle section
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        <EmptyState title="Aucune section" description="Créez des sections pour organiser les leçons." />
      ) : (
        <div className="space-y-3">
          {sections.map((sec) => {
            const sectionLessons = lessons.filter((l) => l.course_section_id === sec.id);
            const expanded = expandedSections.has(sec.id);
            return (
              <div key={sec.id} className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-zinc-50" onClick={() => toggleSection(sec.id)}>
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                    <div>
                      <p className="font-black text-zinc-900">{sec.title}</p>
                      <p className="text-xs text-zinc-500">{sectionLessons.length} leçon(s){sec.description ? ` · ${sec.description}` : ''}</p>
                    </div>
                  </div>
                  {canUpdate && (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => { setEditSection(sec); setSectionTitle(sec.title); setSectionDesc(sec.description ?? ''); setSectionModal(true); }} className="text-xs font-black text-primary-600 hover:underline">Modifier</button>
                      <button type="button" onClick={() => { if (window.confirm('Supprimer cette section ?')) deleteSectionMut.mutate(sec.id); }} className="text-xs font-black text-rose-600 hover:underline">Suppr.</button>
                      <button type="button" onClick={() => openLessonCreate(sec.id)} className="text-xs font-black text-emerald-700 hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />Leçon</button>
                    </div>
                  )}
                </div>
                {expanded && sectionLessons.length > 0 && (
                  <div className="border-t border-zinc-100">
                    {sectionLessons.map((lesson) => (
                      <div key={lesson.id} className="flex items-center justify-between px-8 py-3 hover:bg-zinc-50 border-b border-zinc-50 last:border-b-0">
                        <div className="flex items-center gap-3">
                          {LESSON_TYPE_ICONS[lesson.lesson_type] ?? <BookOpen className="w-4 h-4" />}
                          <div>
                            <p className="text-sm font-bold text-zinc-800">{lesson.title}</p>
                            <p className="text-xs text-zinc-500">{LESSON_TYPE_LABELS[lesson.lesson_type]} · {lesson.duration_minutes} min</p>
                          </div>
                        </div>
                        {canUpdate && (
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openLessonEdit(lesson)} className="text-xs font-black text-primary-600 hover:underline">Modifier</button>
                            <button type="button" onClick={() => { if (window.confirm('Supprimer ?')) deleteLessonMut.mutate(lesson.id); }} className="text-xs font-black text-rose-600 hover:underline">Suppr.</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {expanded && sectionLessons.length === 0 && (
                  <div className="border-t border-zinc-100 px-8 py-4 text-sm text-zinc-400">Aucune leçon dans cette section.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section modal */}
      <Modal open={sectionModal} onClose={() => setSectionModal(false)} title={editSection ? 'Modifier la section' : 'Nouvelle section'} footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setSectionModal(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
          <button type="button" onClick={() => { if (!sectionTitle.trim()) { toast.error('Titre requis.'); return; } saveSectionMut.mutate({ id: editSection?.id, title: sectionTitle.trim(), description: sectionDesc.trim() }); }} disabled={saveSectionMut.isPending} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">Enregistrer</button>
        </div>
      }>
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">Titre
            <input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Nom de la section" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Description
            <textarea value={sectionDesc} onChange={(e) => setSectionDesc(e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
        </div>
      </Modal>

      {/* Lesson modal */}
      <Modal open={lessonModal} onClose={() => setLessonModal(false)} title={editLesson ? 'Modifier la leçon' : 'Nouvelle leçon'} footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setLessonModal(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
          <button type="button" onClick={() => {
            if (!lessonDraft.title.trim()) { toast.error('Titre requis.'); return; }
            if (!lessonDraft.course_section_id) { toast.error('Choisissez une section.'); return; }
            saveLessonMut.mutate({ id: editLesson?.id, data: {
              title: lessonDraft.title.trim(), course_section_id: lessonDraft.course_section_id,
              lesson_type: lessonDraft.lesson_type, content: lessonDraft.content.trim() || null,
              video_url: lessonDraft.video_url.trim() || null, pdf_url: lessonDraft.pdf_url.trim() || null,
              external_url: lessonDraft.external_url.trim() || null,
              duration_minutes: Number(lessonDraft.duration_minutes) || 0,
            }});
          }} disabled={saveLessonMut.isPending} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">Enregistrer</button>
        </div>
      }>
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">Titre
            <input value={lessonDraft.title} onChange={(e) => setLessonDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Section
              <select value={lessonDraft.course_section_id} onChange={(e) => setLessonDraft((d) => ({ ...d, course_section_id: Number(e.target.value) }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value={0}>— Choisir —</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Type
              <select value={lessonDraft.lesson_type} onChange={(e) => setLessonDraft((d) => ({ ...d, lesson_type: e.target.value as LessonType }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                <option value="text">Texte</option><option value="video">Vidéo</option><option value="pdf">PDF</option><option value="external_link">Lien externe</option>
              </select>
            </label>
          </div>
          {lessonDraft.lesson_type === 'text' && (
            <label className="block text-xs font-black uppercase text-zinc-500">Contenu
              <textarea value={lessonDraft.content} onChange={(e) => setLessonDraft((d) => ({ ...d, content: e.target.value }))} rows={4} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
          )}
          {lessonDraft.lesson_type === 'video' && (
            <label className="block text-xs font-black uppercase text-zinc-500">URL Vidéo
              <input value={lessonDraft.video_url} onChange={(e) => setLessonDraft((d) => ({ ...d, video_url: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="https://..." />
            </label>
          )}
          {lessonDraft.lesson_type === 'pdf' && (
            <label className="block text-xs font-black uppercase text-zinc-500">URL PDF
              <input value={lessonDraft.pdf_url} onChange={(e) => setLessonDraft((d) => ({ ...d, pdf_url: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="https://..." />
            </label>
          )}
          {lessonDraft.lesson_type === 'external_link' && (
            <label className="block text-xs font-black uppercase text-zinc-500">Lien externe
              <input value={lessonDraft.external_url} onChange={(e) => setLessonDraft((d) => ({ ...d, external_url: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="https://..." />
            </label>
          )}
          <label className="block text-xs font-black uppercase text-zinc-500">Durée (min)
            <input type="number" min={0} value={lessonDraft.duration_minutes} onChange={(e) => setLessonDraft((d) => ({ ...d, duration_minutes: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Apprenants (Students)
   ══════════════════════════════════════════════════════ */

function StudentsTab({
  brandId, canCreate, canUpdate, canDelete, toast, qc,
}: {
  brandId: string; canCreate: boolean; canUpdate: boolean; canDelete: boolean;
  toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient>;
}) {
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [draft, setDraft] = useState({ full_name: '', email: '', phone: '', company: '', position: '' });

  const studentsQuery = useQuery({
    queryKey: ['academy-students', brandId, q],
    queryFn: async () => {
      const res = await api.get<unknown>(`academy/students${buildQuery({ per_page: 200, search: q.trim() || undefined })}`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const rows = useMemo(() => parseRows<StudentRow>(studentsQuery.data), [studentsQuery.data]);

  const saveMut = useMutation({
    mutationFn: async (p: { id?: number; data: Record<string, unknown> }) => {
      const res = p.id
        ? await api.put<StudentRow>(`academy/students/${p.id}`, p.data)
        : await api.post<StudentRow>('academy/students', p.data);
      if (!res.ok) { const err = flattenFieldErrors(res.errors as Record<string, unknown>); throw new Error(err.length > 0 ? err.join(' ') : res.message); }
    },
    onSuccess: () => {
      toast.success(editing ? 'Apprenant mis à jour.' : 'Apprenant créé.');
      setModalOpen(false); setEditing(null);
      void qc.invalidateQueries({ queryKey: ['academy-students'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.del(`academy/students/${id}`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Supprimé.'); void qc.invalidateQueries({ queryKey: ['academy-students'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <FilterBar query={q} onQueryChange={setQ} />
        {canCreate && (
          <button type="button" onClick={() => { setEditing(null); setDraft({ full_name: '', email: '', phone: '', company: '', position: '' }); setModalOpen(true); }}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvel apprenant
          </button>
        )}
      </div>

      {rows.length === 0 && !studentsQuery.isLoading ? (
        <EmptyState title="Aucun apprenant" description="Ajoutez des apprenants pour les inscrire aux formations." />
      ) : (
        <DataTable<StudentRow> rows={rows} loading={studentsQuery.isLoading} columns={[
          { key: 'name', header: 'Nom', cell: (r) => <span className="font-black text-zinc-900">{r.full_name}</span> },
          { key: 'email', header: 'Email', cell: (r) => <span className="text-sm text-zinc-700">{r.email}</span> },
          { key: 'phone', header: 'Tél.', cell: (r) => <span className="text-sm text-zinc-700">{r.phone ?? '—'}</span> },
          { key: 'position', header: 'Poste', cell: (r) => <span className="text-sm text-zinc-700">{r.position ?? '—'}</span> },
          { key: 'enrollments', header: 'Inscriptions', cell: (r) => <span className="text-sm font-bold">{r.enrollments_count ?? 0}</span> },
          { key: 'actions', header: '', cell: (r) => (
            <div className="flex items-center gap-2">
              {canUpdate && <button type="button" onClick={() => { setEditing(r); setDraft({ full_name: r.full_name, email: r.email, phone: r.phone ?? '', company: r.company ?? '', position: r.position ?? '' }); setModalOpen(true); }} className="text-xs font-black text-primary-600 hover:underline">Modifier</button>}
              {canDelete && <button type="button" onClick={() => { if (window.confirm('Supprimer ?')) deleteMut.mutate(r.id); }} className="text-xs font-black text-rose-600 hover:underline">Suppr.</button>}
            </div>
          )},
        ]} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier l\'apprenant' : 'Nouvel apprenant'} footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
          <button type="button" onClick={() => {
            if (!draft.full_name.trim() || !draft.email.trim()) { toast.error('Nom et email requis.'); return; }
            saveMut.mutate({ id: editing?.id, data: { full_name: draft.full_name.trim(), email: draft.email.trim(), phone: draft.phone.trim() || null, company: draft.company.trim() || null, position: draft.position.trim() || null } });
          }} disabled={saveMut.isPending} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">Enregistrer</button>
        </div>
      }>
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">Nom complet <span className="text-rose-600">*</span>
            <input value={draft.full_name} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Email <span className="text-rose-600">*</span>
            <input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Téléphone
              <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Poste
              <input value={draft.position} onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Inscriptions (Enrollments)
   ══════════════════════════════════════════════════════ */

function EnrollmentsTab({
  brandId, canCreate, canDelete, toast, qc,
}: {
  brandId: string; canCreate: boolean; canDelete: boolean;
  toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({ course_id: '', student_id: '', enrollment_type: 'free' });

  const enrollQuery = useQuery({
    queryKey: ['academy-enrollments', brandId],
    queryFn: async () => {
      const res = await api.get<unknown>('academy/enrollments?per_page=200');
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const coursesQuery = useQuery({
    queryKey: ['academy-courses-list', brandId],
    queryFn: async () => {
      const res = await api.get<unknown>('academy/courses?per_page=200');
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ['academy-students-list', brandId],
    queryFn: async () => {
      const res = await api.get<unknown>('academy/students?per_page=200');
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const rows = useMemo(() => parseRows<EnrollmentRow>(enrollQuery.data), [enrollQuery.data]);
  const courseOptions = useMemo(() => parseRows<AcademyCourse>(coursesQuery.data), [coursesQuery.data]);
  const studentOptions = useMemo(() => parseRows<StudentRow>(studentsQuery.data), [studentsQuery.data]);

  const createMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.post('academy/enrollments', data);
      if (!res.ok) { const err = flattenFieldErrors(res.errors as Record<string, unknown>); throw new Error(err.length > 0 ? err.join(' ') : res.message); }
    },
    onSuccess: () => {
      toast.success('Inscription créée.');
      setModalOpen(false); setDraft({ course_id: '', student_id: '', enrollment_type: 'free' });
      void qc.invalidateQueries({ queryKey: ['academy-enrollments'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.del(`academy/enrollments/${id}`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Inscription annulée.'); void qc.invalidateQueries({ queryKey: ['academy-enrollments'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const statusMut = useMutation({
    mutationFn: async (p: { id: number; status: string }) => {
      const r = await api.put(`academy/enrollments/${p.id}`, { status: p.status });
      if (!r.ok) throw new Error(r.message);
    },
    onSuccess: () => { toast.success('Statut mis à jour.'); void qc.invalidateQueries({ queryKey: ['academy-enrollments'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-black text-zinc-800">{rows.length} inscription(s)</h3>
        {canCreate && (
          <button type="button" onClick={() => { setDraft({ course_id: '', student_id: '', enrollment_type: 'free' }); setModalOpen(true); }}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouvelle inscription
          </button>
        )}
      </div>

      {rows.length === 0 && !enrollQuery.isLoading ? (
        <EmptyState title="Aucune inscription" description="Inscrivez des apprenants aux formations." />
      ) : (
        <DataTable<EnrollmentRow> rows={rows} loading={enrollQuery.isLoading} columns={[
          { key: 'student', header: 'Apprenant', cell: (r) => <span className="font-bold text-zinc-900">{r.student?.full_name ?? '—'}</span> },
          { key: 'course', header: 'Formation', cell: (r) => <span className="text-sm text-zinc-700">{r.course?.title ?? '—'}</span> },
          { key: 'status', header: 'Statut', cell: (r) => (
            <select value={r.status} onChange={(e) => statusMut.mutate({ id: r.id, status: e.target.value })}
              className="px-2 py-1 rounded-lg border border-zinc-200 text-sm font-bold bg-white cursor-pointer">
              <option value="pending">En attente</option><option value="active">Actif</option>
              <option value="completed">Terminé</option><option value="expired">Expiré</option><option value="cancelled">Annulé</option>
            </select>
          )},
          { key: 'progress', header: 'Progression', cell: (r) => (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 rounded-full" style={{ width: `${r.progress_percent}%` }} />
              </div>
              <span className="text-xs font-bold text-zinc-600">{r.progress_percent}%</span>
            </div>
          )},
          { key: 'date', header: 'Inscrit le', cell: (r) => <span className="text-sm text-zinc-700">{fmtDate(r.enrolled_at)}</span> },
          { key: 'actions', header: '', cell: (r) => (
            canDelete ? <button type="button" onClick={() => { if (window.confirm('Annuler cette inscription ?')) deleteMut.mutate(r.id); }} className="text-xs font-black text-rose-600 hover:underline">Suppr.</button> : null
          )},
        ]} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle inscription" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
          <button type="button" onClick={() => {
            if (!draft.course_id || !draft.student_id) { toast.error('Formation et apprenant requis.'); return; }
            createMut.mutate({ course_id: Number(draft.course_id), student_id: Number(draft.student_id), enrollment_type: draft.enrollment_type, status: 'active' });
          }} disabled={createMut.isPending} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">Inscrire</button>
        </div>
      }>
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase text-zinc-500">Formation <span className="text-rose-600">*</span>
            <select value={draft.course_id} onChange={(e) => setDraft((d) => ({ ...d, course_id: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
              <option value="">— Choisir —</option>
              {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Apprenant <span className="text-rose-600">*</span>
            <select value={draft.student_id} onChange={(e) => setDraft((d) => ({ ...d, student_id: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
              <option value="">— Choisir —</option>
              {studentOptions.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>)}
            </select>
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Type
            <select value={draft.enrollment_type} onChange={(e) => setDraft((d) => ({ ...d, enrollment_type: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
              <option value="free">Gratuite</option><option value="paid">Payante</option><option value="manual">Manuelle</option>
            </select>
          </label>
        </div>
      </Modal>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   TAB: Quiz
   ══════════════════════════════════════════════════════ */

function QuizzesTab({
  brandId, canCreate, canUpdate, canDelete, toast, qc,
}: {
  brandId: string; canCreate: boolean; canUpdate: boolean; canDelete: boolean;
  toast: ReturnType<typeof useToast>; qc: ReturnType<typeof useQueryClient>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  const coursesQuery = useQuery({
    queryKey: ['academy-courses-list', brandId],
    queryFn: async () => {
      const res = await api.get<unknown>('academy/courses?per_page=200');
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const courseOptions = useMemo(() => parseRows<AcademyCourse>(coursesQuery.data), [coursesQuery.data]);

  const quizzesQuery = useQuery({
    queryKey: ['academy-quizzes', selectedCourseId],
    enabled: !!selectedCourseId,
    queryFn: async () => {
      const res = await api.get<unknown>(`academy/courses/${selectedCourseId}/quizzes`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const quizRows = useMemo(() => parseRows<QuizRow>(quizzesQuery.data), [quizzesQuery.data]);

  const [quizDraft, setQuizDraft] = useState({ title: '', description: '', passing_score: '60', max_attempts: '3' });
  type QuestionDraft = { question_text: string; question_type: string; answers: { answer_text: string; is_correct: boolean }[] };
  const [questionsDraft, setQuestionsDraft] = useState<QuestionDraft[]>([]);

  function addQuestion() {
    setQuestionsDraft((prev) => [...prev, { question_text: '', question_type: 'multiple_choice', answers: [{ answer_text: '', is_correct: true }, { answer_text: '', is_correct: false }] }]);
  }

  const createQuizMut = useMutation({
    mutationFn: async () => {
      if (!selectedCourseId) throw new Error('Sélectionnez une formation.');
      const res = await api.post(`academy/courses/${selectedCourseId}/quizzes`, {
        title: quizDraft.title.trim(), description: quizDraft.description.trim() || null,
        passing_score: Number(quizDraft.passing_score) || 60, max_attempts: Number(quizDraft.max_attempts) || 3,
        questions: questionsDraft.map((q, qi) => ({
          question_text: q.question_text.trim(), question_type: q.question_type, sort_order: qi,
          answers: q.answers.map((a, ai) => ({ answer_text: a.answer_text.trim(), is_correct: a.is_correct, sort_order: ai })),
        })),
      });
      if (!res.ok) { const err = flattenFieldErrors(res.errors as Record<string, unknown>); throw new Error(err.length > 0 ? err.join(' ') : res.message); }
    },
    onSuccess: () => {
      toast.success('Quiz créé.');
      setModalOpen(false); setQuizDraft({ title: '', description: '', passing_score: '60', max_attempts: '3' }); setQuestionsDraft([]);
      void qc.invalidateQueries({ queryKey: ['academy-quizzes'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  const deleteQuizMut = useMutation({
    mutationFn: async (id: number) => { const r = await api.del(`academy/courses/${selectedCourseId}/quizzes/${id}`); if (!r.ok) throw new Error(r.message); },
    onSuccess: () => { toast.success('Quiz supprimé.'); void qc.invalidateQueries({ queryKey: ['academy-quizzes'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-zinc-600">Formation :</label>
          <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold min-w-[200px]">
            <option value="">— Choisir une formation —</option>
            {courseOptions.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        {canCreate && selectedCourseId && (
          <button type="button" onClick={() => { setQuizDraft({ title: '', description: '', passing_score: '60', max_attempts: '3' }); setQuestionsDraft([]); setModalOpen(true); }}
            className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau quiz
          </button>
        )}
      </div>

      {!selectedCourseId ? (
        <EmptyState title="Sélectionnez une formation" description="Choisissez une formation pour voir ses quiz." />
      ) : quizRows.length === 0 && !quizzesQuery.isLoading ? (
        <EmptyState title="Aucun quiz" description="Créez un quiz pour cette formation." />
      ) : (
        <DataTable<QuizRow> rows={quizRows} loading={quizzesQuery.isLoading} columns={[
          { key: 'title', header: 'Quiz', cell: (r) => <span className="font-black text-zinc-900">{r.title}</span> },
          { key: 'passing', header: 'Score min.', cell: (r) => <span className="text-sm font-bold">{r.passing_score}%</span> },
          { key: 'attempts', header: 'Max tentatives', cell: (r) => <span className="text-sm">{r.max_attempts}</span> },
          { key: 'questions', header: 'Questions', cell: (r) => <span className="text-sm font-bold">{r.questions_count ?? 0}</span> },
          { key: 'status', header: 'Actif', cell: (r) => <StatusChip tone={r.is_active ? 'success' : 'neutral'}>{r.is_active ? 'Oui' : 'Non'}</StatusChip> },
          { key: 'actions', header: '', cell: (r) => (
            canDelete ? <button type="button" onClick={() => { if (window.confirm('Supprimer ce quiz ?')) deleteQuizMut.mutate(r.id); }} className="text-xs font-black text-rose-600 hover:underline">Suppr.</button> : null
          )},
        ]} />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau quiz" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black">Annuler</button>
          <button type="button" onClick={() => {
            if (!quizDraft.title.trim()) { toast.error('Titre requis.'); return; }
            createQuizMut.mutate();
          }} disabled={createQuizMut.isPending} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60">Créer</button>
        </div>
      }>
        <div className="space-y-4 max-h-[min(70vh,560px)] overflow-y-auto pr-1">
          <label className="block text-xs font-black uppercase text-zinc-500">Titre <span className="text-rose-600">*</span>
            <input value={quizDraft.title} onChange={(e) => setQuizDraft((d) => ({ ...d, title: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <label className="block text-xs font-black uppercase text-zinc-500">Description
            <textarea value={quizDraft.description} onChange={(e) => setQuizDraft((d) => ({ ...d, description: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">Score minimum (%)
              <input type="number" min={0} max={100} value={quizDraft.passing_score} onChange={(e) => setQuizDraft((d) => ({ ...d, passing_score: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">Max tentatives
              <input type="number" min={1} value={quizDraft.max_attempts} onChange={(e) => setQuizDraft((d) => ({ ...d, max_attempts: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
            </label>
          </div>

          <div className="border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-black text-zinc-800">Questions ({questionsDraft.length})</h4>
              <button type="button" onClick={addQuestion} className="text-xs font-black text-primary-600 hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />Ajouter</button>
            </div>
            {questionsDraft.map((question, qi) => (
              <div key={qi} className="card-muted p-3 mb-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-500">Question {qi + 1}</span>
                  <button type="button" onClick={() => setQuestionsDraft((prev) => prev.filter((_, i) => i !== qi))} className="text-xs font-black text-rose-600">Retirer</button>
                </div>
                <input value={question.question_text} onChange={(e) => setQuestionsDraft((prev) => prev.map((q, i) => i === qi ? { ...q, question_text: e.target.value } : q))} className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" placeholder="Texte de la question" />
                <select value={question.question_type} onChange={(e) => setQuestionsDraft((prev) => prev.map((q, i) => i === qi ? { ...q, question_type: e.target.value } : q))} className="px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold">
                  <option value="multiple_choice">Choix multiple</option>
                  <option value="true_false">Vrai / Faux</option>
                </select>
                <div className="space-y-2">
                  {question.answers.map((ans, ai) => (
                    <div key={ai} className="flex items-center gap-2">
                      <input type="checkbox" checked={ans.is_correct} onChange={(e) => setQuestionsDraft((prev) => prev.map((q, i) => i === qi ? { ...q, answers: q.answers.map((a, j) => j === ai ? { ...a, is_correct: e.target.checked } : a) } : q))} className="rounded" />
                      <input value={ans.answer_text} onChange={(e) => setQuestionsDraft((prev) => prev.map((q, i) => i === qi ? { ...q, answers: q.answers.map((a, j) => j === ai ? { ...a, answer_text: e.target.value } : a) } : q))} className="flex-1 px-2 py-1.5 rounded-lg border border-zinc-200 text-sm" placeholder={`Réponse ${ai + 1}`} />
                      <button type="button" onClick={() => setQuestionsDraft((prev) => prev.map((q, i) => i === qi ? { ...q, answers: q.answers.filter((_, j) => j !== ai) } : q))} className="text-xs text-rose-500">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setQuestionsDraft((prev) => prev.map((q, i) => i === qi ? { ...q, answers: [...q.answers, { answer_text: '', is_correct: false }] } : q))} className="text-xs font-black text-primary-600 hover:underline">+ Réponse</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
