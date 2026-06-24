import React, { useMemo, useState } from 'react';
import { Plus, RefreshCw, Rocket, Trash2 } from 'lucide-react';
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

type CourseStatus = 'draft' | 'published' | 'archived';
type EnrollmentType = 'free' | 'paid';
type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

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
  enrollments_count?: number;
  created_at: string;
};

type CourseListPayload =
  | { data?: AcademyCourse[]; meta?: { total?: number } }
  | { data?: { data?: AcademyCourse[]; meta?: { total?: number } }; meta?: { total?: number } };

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

const defaultDraft: CourseDraft = {
  title: '',
  slug: '',
  short_description: '',
  description: '',
  status: 'draft',
  enrollment_type: 'free',
  price: '0',
  currency: 'USD',
  duration_minutes: '0',
  difficulty_level: 'beginner',
  learning_objectives: '',
  prerequisites: '',
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function parseCourseRows(payload: CourseListPayload | undefined): AcademyCourse[] {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === 'object' && Array.isArray(payload.data.data)) {
    return payload.data.data;
  }
  return [];
}

function statusTone(status: CourseStatus): 'neutral' | 'success' | 'warning' {
  if (status === 'published') return 'success';
  if (status === 'archived') return 'neutral';
  return 'warning';
}

function courseToDraft(course: AcademyCourse): CourseDraft {
  return {
    title: course.title,
    slug: course.slug,
    short_description: course.short_description ?? '',
    description: course.description ?? '',
    status: course.status,
    enrollment_type: course.enrollment_type,
    price: String(course.price ?? 0),
    currency: course.currency ?? 'USD',
    duration_minutes: String(course.duration_minutes ?? 0),
    difficulty_level: course.difficulty_level ?? 'beginner',
    learning_objectives: '',
    prerequisites: '',
  };
}

function draftToPayload(draft: CourseDraft): Record<string, unknown> {
  const learningObjectives = draft.learning_objectives
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
  const prerequisites = draft.prerequisites
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    title: draft.title.trim(),
    slug: draft.slug.trim(),
    short_description: draft.short_description.trim() || null,
    description: draft.description.trim() || null,
    status: draft.status,
    enrollment_type: draft.enrollment_type,
    price: Number.isFinite(Number(draft.price)) ? Number(draft.price) : 0,
    currency: draft.currency.trim() || 'USD',
    duration_minutes: Number.isFinite(Number(draft.duration_minutes)) ? Number(draft.duration_minutes) : 0,
    difficulty_level: draft.difficulty_level,
    learning_objectives: learningObjectives,
    prerequisites,
  };
}

export function AcademyScreen() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeBrandId } = useBrand();
  const { hasPermission } = useAuth();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | CourseStatus>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AcademyCourse | null>(null);
  const [draft, setDraft] = useState<CourseDraft>(defaultDraft);

  const canCreate = hasPermission(['academy_courses.create', 'hr.update']);
  const canUpdate = hasPermission(['academy_courses.update', 'hr.update']);
  const canDelete = hasPermission(['academy_courses.delete', 'hr.delete']);
  const canPublish = hasPermission(['academy_courses.publish', 'hr.update']);

  const queryKey = ['academy-courses', activeBrandId, q, status];

  const coursesQuery = useQuery({
    queryKey,
    enabled: !!activeBrandId,
    queryFn: async () => {
      const res = await api.get<CourseListPayload>(
        `academy/courses${buildQuery({ per_page: 200, search: q.trim() || undefined, status: status || undefined })}`,
      );
      if (!res.ok) {
        throw new Error(res.message);
      }
      return res.data;
    },
  });

  const rows = useMemo(() => parseCourseRows(coursesQuery.data), [coursesQuery.data]);

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post<AcademyCourse>('academy/courses', payload);
      if (!res.ok) {
        const err = flattenFieldErrors(res.errors as Record<string, unknown>);
        throw new Error(err.length > 0 ? err.join(' ') : res.message);
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success('Course created.');
      setModalOpen(false);
      setEditingCourse(null);
      setDraft(defaultDraft);
      void queryClient.invalidateQueries({ queryKey: ['academy-courses'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create course.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: { id: number; payload: Record<string, unknown> }) => {
      const res = await api.patch<AcademyCourse>(`academy/courses/${input.id}`, input.payload);
      if (!res.ok) {
        const err = flattenFieldErrors(res.errors as Record<string, unknown>);
        throw new Error(err.length > 0 ? err.join(' ') : res.message);
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success('Course updated.');
      setModalOpen(false);
      setEditingCourse(null);
      setDraft(defaultDraft);
      void queryClient.invalidateQueries({ queryKey: ['academy-courses'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update course.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.del(`academy/courses/${id}`);
      if (!res.ok) {
        throw new Error(res.message);
      }
      return true;
    },
    onSuccess: () => {
      toast.success('Course deleted.');
      void queryClient.invalidateQueries({ queryKey: ['academy-courses'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete course.');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.post<AcademyCourse>(`academy/courses/${id}/publish`);
      if (!res.ok) {
        throw new Error(res.message);
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success('Course published.');
      void queryClient.invalidateQueries({ queryKey: ['academy-courses'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to publish course.');
    },
  });

  function openCreateModal() {
    setEditingCourse(null);
    setDraft(defaultDraft);
    setModalOpen(true);
  }

  function openEditModal(course: AcademyCourse) {
    setEditingCourse(course);
    setDraft(courseToDraft(course));
    setModalOpen(true);
  }

  function onChangeTitle(value: string) {
    setDraft((prev) => ({
      ...prev,
      title: value,
      slug: prev.slug ? prev.slug : slugify(value),
    }));
  }

  function onSubmitCourse() {
    if (!draft.title.trim()) {
      toast.error('Title is required.');
      return;
    }
    if (!draft.slug.trim()) {
      toast.error('Slug is required.');
      return;
    }

    const payload = draftToPayload(draft);
    if (editingCourse) {
      updateMutation.mutate({ id: editingCourse.id, payload });
      return;
    }
    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Management"
        subtitle="Manage academy courses: create, update, publish, and archive."
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['academy-courses'] })}
              className="px-4 py-2 rounded-2xl border border-zinc-200 bg-white text-sm font-black inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            {canCreate ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 rounded-2xl bg-primary-600 text-white text-sm font-black inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
            ) : null}
          </div>
        }
      />

      <FilterBar
        query={q}
        onQueryChange={setQ}
        right={
          <select
            value={status}
            onChange={(e) => setStatus((e.target.value as CourseStatus) || '')}
            className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        }
      />

      {coursesQuery.isError ? (
        <EmptyState title="Failed to load courses" description={coursesQuery.error instanceof Error ? coursesQuery.error.message : 'Unknown error'} />
      ) : rows.length === 0 && !coursesQuery.isLoading ? (
        <EmptyState title="No courses found" description="Create your first academy course to start enrolling students." />
      ) : (
        <DataTable<AcademyCourse>
          rows={rows}
          loading={coursesQuery.isLoading}
          columns={[
            {
              key: 'title',
              header: 'Course',
              cell: (row) => (
                <div className="space-y-1">
                  <p className="font-black text-zinc-900">{row.title}</p>
                  <p className="text-xs text-zinc-500">{row.slug}</p>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              cell: (row) => <span className="text-sm">{row.category?.name ?? '—'}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => <StatusChip tone={statusTone(row.status)}>{row.status}</StatusChip>,
            },
            {
              key: 'difficulty',
              header: 'Difficulty',
              cell: (row) => <span className="text-sm capitalize">{row.difficulty_level}</span>,
            },
            {
              key: 'price',
              header: 'Price',
              cell: (row) => (
                <span className="text-sm font-bold">
                  {Number(row.price).toFixed(2)} {row.currency}
                </span>
              ),
            },
            {
              key: 'duration',
              header: 'Duration',
              cell: (row) => <span className="text-sm">{row.duration_minutes} min</span>,
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (row) => (
                <div className="flex items-center gap-3">
                  {canUpdate ? (
                    <button
                      type="button"
                      onClick={() => openEditModal(row)}
                      className="text-sm font-black text-primary-600 hover:underline"
                    >
                      Edit
                    </button>
                  ) : null}
                  {canPublish && row.status !== 'published' ? (
                    <button
                      type="button"
                      onClick={() => publishMutation.mutate(row.id)}
                      className="text-sm font-black text-emerald-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      Publish
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete course "${row.title}"?`)) {
                          deleteMutation.mutate(row.id);
                        }
                      }}
                      className="text-sm font-black text-rose-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingCourse(null);
          setDraft(defaultDraft);
        }}
        title={editingCourse ? 'Edit Course' : 'Create Course'}
        subtitle="All fields are saved directly to the academy course API."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false);
                setEditingCourse(null);
                setDraft(defaultDraft);
              }}
              className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm font-black"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmitCourse}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-black disabled:opacity-60"
            >
              {editingCourse ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">
              Title
              <input
                value={draft.title}
                onChange={(e) => onChangeTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
                placeholder="Course title"
              />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">
              Slug
              <input
                value={draft.slug}
                onChange={(e) => setDraft((d) => ({ ...d, slug: slugify(e.target.value) }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
                placeholder="course-slug"
              />
            </label>
          </div>

          <label className="block text-xs font-black uppercase text-zinc-500">
            Short Description
            <input
              value={draft.short_description}
              onChange={(e) => setDraft((d) => ({ ...d, short_description: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              placeholder="Brief summary"
            />
          </label>

          <label className="block text-xs font-black uppercase text-zinc-500">
            Description
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              rows={4}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              placeholder="Full course description"
            />
          </label>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">
              Status
              <select
                value={draft.status}
                onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as CourseStatus }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="block text-xs font-black uppercase text-zinc-500">
              Enrollment
              <select
                value={draft.enrollment_type}
                onChange={(e) => setDraft((d) => ({ ...d, enrollment_type: e.target.value as EnrollmentType }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
              >
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </label>

            <label className="block text-xs font-black uppercase text-zinc-500">
              Difficulty
              <select
                value={draft.difficulty_level}
                onChange={(e) => setDraft((d) => ({ ...d, difficulty_level: e.target.value as DifficultyLevel }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>

            <label className="block text-xs font-black uppercase text-zinc-500">
              Duration (min)
              <input
                type="number"
                min={0}
                value={draft.duration_minutes}
                onChange={(e) => setDraft((d) => ({ ...d, duration_minutes: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">
              Price
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">
              Currency
              <input
                value={draft.currency}
                maxLength={3}
                onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs font-black uppercase text-zinc-500">
              Learning Objectives (one per line)
              <textarea
                rows={4}
                value={draft.learning_objectives}
                onChange={(e) => setDraft((d) => ({ ...d, learning_objectives: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </label>
            <label className="block text-xs font-black uppercase text-zinc-500">
              Prerequisites (one per line)
              <textarea
                rows={4}
                value={draft.prerequisites}
                onChange={(e) => setDraft((d) => ({ ...d, prerequisites: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm"
              />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
