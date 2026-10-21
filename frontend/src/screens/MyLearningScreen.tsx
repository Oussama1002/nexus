import React, { useMemo, useState } from 'react';
import { Award, ArrowLeft, BookOpen, CheckCircle2, Circle, FileText, GraduationCap, Link2, Play, Video } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusChip } from '../components/ui/StatusChip';
import { useToast } from '../context/ToastContext';
import { useBrand } from '../context/BrandContext';
import * as api from '../lib/api';

async function openCertificatePdf(enrollmentId: number): Promise<void> {
  const token = api.getStoredToken();
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000/api';
  const url = `${base.replace(/\/$/, '')}/academy/learn/enrollments/${enrollmentId}/certificate`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error('Certificat indisponible.');
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

type LessonType = 'video' | 'pdf' | 'text' | 'external_link';
type EnrollmentStatus = 'pending' | 'active' | 'completed' | 'expired' | 'cancelled';

type MyCourseRow = {
  enrollment_id: number;
  course: {
    id: number;
    title: string;
    short_description: string | null;
    description: string | null;
    difficulty_level: string;
    duration_minutes: number;
  };
  status: EnrollmentStatus;
  progress_percent: number;
  enrolled_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  has_certificate: boolean;
};

type PlayerLesson = {
  id: number;
  title: string;
  lesson_type: LessonType;
  duration_minutes: number;
  is_preview: boolean;
  sort_order: number;
  progress_status: 'viewed' | 'completed' | null;
  completed_at: string | null;
};

type PlayerSection = {
  id: number;
  title: string;
  description: string | null;
  sort_order: number;
  lessons: PlayerLesson[];
};

type PlayerPayload = {
  course: {
    id: number;
    title: string;
    short_description: string | null;
    description: string | null;
    difficulty_level: string;
    duration_minutes: number;
  };
  enrollment: {
    id: number;
    status: EnrollmentStatus;
    progress_percent: number;
    completed_at: string | null;
  } | null;
  preview?: boolean;
  sections: PlayerSection[];
};

type LessonDetail = {
  lesson: {
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
    resources: Array<{ id: number; title: string; resource_type: string; resource_url: string | null; file_path: string | null }>;
  };
  progress: { status: 'viewed' | 'completed'; last_position_seconds: number; completed_at: string | null } | null;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  pending: 'En attente',
  active: 'En cours',
  completed: 'Terminé',
  expired: 'Expiré',
  cancelled: 'Annulé',
};

function statusTone(s: EnrollmentStatus): 'warning' | 'success' | 'info' | 'danger' | 'neutral' {
  if (s === 'completed') return 'success';
  if (s === 'active') return 'info';
  if (s === 'pending') return 'warning';
  return 'neutral';
}

function parseRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data;
  }
  return [];
}

export function MyLearningScreen() {
  const { activeBrandId } = useBrand();
  const [openCourseId, setOpenCourseId] = useState<number | null>(null);

  if (!activeBrandId) {
    return <EmptyState title="Marque requise" description="Choisissez une marque active pour voir vos formations." />;
  }

  if (openCourseId !== null) {
    return <CoursePlayer courseId={openCourseId} onBack={() => setOpenCourseId(null)} />;
  }

  return <MyCoursesList onOpen={(id) => setOpenCourseId(id)} />;
}

function MyCoursesList({ onOpen }: { onOpen: (courseId: number) => void }) {
  const toast = useToast();
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-learning-courses'],
    queryFn: async () => {
      const res = await api.get<unknown>('academy/learn/courses');
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
  });

  const rows = useMemo(() => parseRows<MyCourseRow>(data), [data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Mes formations" subtitle="Reprenez vos cours là où vous les avez laissés." />

      {isLoading && <div className="text-sm text-zinc-500">Chargement…</div>}
      {error instanceof Error && <div className="text-sm font-bold text-rose-700">{error.message}</div>}

      {!isLoading && rows.length === 0 && (
        <EmptyState
          title="Aucune formation"
          description="Vous n'êtes inscrit à aucune formation pour l'instant."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((row) => (
          <button
            key={row.enrollment_id}
            type="button"
            onClick={() => onOpen(row.course.id)}
            className="card p-5 text-left hover:border-primary-400 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
                <GraduationCap className="w-5 h-5" />
              </div>
              <StatusChip tone={statusTone(row.status)}>{STATUS_LABELS[row.status]}</StatusChip>
            </div>

            <h3 className="font-black text-zinc-900 text-base mb-1">{row.course.title}</h3>
            <p className="text-xs text-zinc-500 line-clamp-2 min-h-[2rem]">
              {row.course.short_description || row.course.description || '—'}
            </p>

            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-zinc-500">
              <span>{DIFFICULTY_LABELS[row.course.difficulty_level] ?? row.course.difficulty_level}</span>
              <span>·</span>
              <span>{row.course.duration_minutes} min</span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-black text-zinc-700 mb-1">
                <span>Progression</span>
                <span>{row.progress_percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full bg-primary-600 transition-all"
                  style={{ width: `${row.progress_percent}%` }}
                />
              </div>
            </div>

            {row.due_at && row.status !== 'completed' && (
              <p className="mt-2 text-[11px] font-bold text-rose-600">
                À terminer avant le {new Date(row.due_at).toLocaleDateString('fr-FR')}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between">
              {row.has_certificate ? (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCertificatePdf(row.enrollment_id).catch((err) =>
                      toast.error(err instanceof Error ? err.message : 'Erreur.'),
                    );
                  }}
                  className="text-xs font-black text-emerald-700 inline-flex items-center gap-1 hover:underline"
                >
                  <Award className="w-3.5 h-3.5" /> Certificat
                </span>
              ) : (
                <span />
              )}
              <span className="text-sm font-black text-primary-600 inline-flex items-center gap-1">
                {row.progress_percent === 0 ? 'Commencer' : row.progress_percent >= 100 ? 'Revoir' : 'Continuer'}
                <Play className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function lessonIcon(type: LessonType) {
  if (type === 'video') return <Video className="w-3.5 h-3.5" />;
  if (type === 'pdf') return <FileText className="w-3.5 h-3.5" />;
  if (type === 'external_link') return <Link2 className="w-3.5 h-3.5" />;
  return <BookOpen className="w-3.5 h-3.5" />;
}

export function CoursePreview({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  return <CoursePlayer courseId={courseId} onBack={onBack} preview backLabel="Retour à la formation" />;
}

function CoursePlayer({
  courseId, onBack, preview = false, backLabel = 'Retour à mes formations',
}: {
  courseId: number;
  onBack: () => void;
  preview?: boolean;
  backLabel?: string;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [currentLessonId, setCurrentLessonId] = useState<number | null>(null);

  const courseQuery = useQuery({
    queryKey: ['player-course', preview, courseId],
    queryFn: async () => {
      const path = preview ? `academy/courses/${courseId}/preview` : `academy/learn/courses/${courseId}`;
      const res = await api.get<PlayerPayload>(path);
      if (!res.ok) throw new Error(res.message);
      return res.data as PlayerPayload;
    },
  });

  const payload = courseQuery.data;

  const firstUnfinishedLessonId = useMemo(() => {
    if (!payload) return null;
    for (const section of payload.sections) {
      for (const lesson of section.lessons) {
        if (lesson.progress_status !== 'completed') return lesson.id;
      }
    }
    return payload.sections[0]?.lessons[0]?.id ?? null;
  }, [payload]);

  const activeLessonId = currentLessonId ?? firstUnfinishedLessonId;

  const lessonQuery = useQuery({
    queryKey: ['player-lesson', preview, activeLessonId],
    enabled: activeLessonId != null,
    queryFn: async () => {
      const path = preview ? `academy/lessons/${activeLessonId}/preview` : `academy/learn/lessons/${activeLessonId}`;
      const res = await api.get<LessonDetail>(path);
      if (!res.ok) throw new Error(res.message);
      return res.data as LessonDetail;
    },
  });

  const completeMut = useMutation({
    mutationFn: async (lessonId: number) => {
      const res = await api.post(`academy/learn/lessons/${lessonId}/complete`);
      if (!res.ok) throw new Error(res.message);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Leçon marquée comme terminée.');
      void qc.invalidateQueries({ queryKey: ['player-course', preview, courseId] });
      void qc.invalidateQueries({ queryKey: ['my-learning-courses'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Erreur.'),
  });

  if (courseQuery.isLoading) {
    return <div className="text-sm text-zinc-500">Chargement…</div>;
  }
  if (courseQuery.error instanceof Error) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="text-sm font-black text-zinc-700 inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <div className="text-sm font-bold text-rose-700">{courseQuery.error.message}</div>
      </div>
    );
  }
  if (!payload) return null;

  const lesson = lessonQuery.data?.lesson ?? null;
  const lessonProgress = lessonQuery.data?.progress ?? null;
  const isCompleted = lessonProgress?.status === 'completed';

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-sm font-black text-zinc-700 inline-flex items-center gap-1 hover:text-primary-600">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </button>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-zinc-900">{payload.course.title}</h2>
              {preview && <StatusChip tone="info">Aperçu</StatusChip>}
            </div>
            <p className="text-sm text-zinc-500 mt-1">{payload.course.short_description || '—'}</p>
          </div>
          {!preview && payload.enrollment?.status === 'completed' && (
            <button
              type="button"
              onClick={() =>
                payload.enrollment &&
                openCertificatePdf(payload.enrollment.id).catch((e) =>
                  toast.error(e instanceof Error ? e.message : 'Erreur.'),
                )
              }
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black inline-flex items-center gap-2"
            >
              <Award className="w-4 h-4" /> Télécharger le certificat
            </button>
          )}
        </div>
        {!preview && payload.enrollment && (
          <>
            <div className="mt-3 flex items-center justify-between text-xs font-black text-zinc-700">
              <span>Progression du cours</span>
              <span>{payload.enrollment.progress_percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100 overflow-hidden mt-1">
              <div className="h-full bg-primary-600 transition-all" style={{ width: `${payload.enrollment.progress_percent}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <aside className="card p-3 space-y-3 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto">
          {payload.sections.length === 0 && (
            <p className="text-sm text-zinc-500 px-2 py-3">Aucune section.</p>
          )}
          {payload.sections.map((section) => (
            <div key={section.id} className="space-y-1">
              <h3 className="text-xs font-black uppercase text-zinc-500 px-2">{section.title}</h3>
              <ul className="space-y-0.5">
                {section.lessons.map((l) => {
                  const active = l.id === activeLessonId;
                  const done = l.progress_status === 'completed';
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setCurrentLessonId(l.id)}
                        className={`w-full text-left px-2 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                          active ? 'bg-primary-50 text-primary-700 font-black' : 'hover:bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-400 shrink-0" />
                        )}
                        <span className="shrink-0 text-zinc-500">{lessonIcon(l.lesson_type)}</span>
                        <span className="truncate">{l.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        <section className="card p-5 min-h-[20rem]">
          {!activeLessonId && (
            <EmptyState title="Aucune leçon" description="Ce cours n'a pas encore de leçons publiées." />
          )}
          {activeLessonId && lessonQuery.isLoading && <div className="text-sm text-zinc-500">Chargement de la leçon…</div>}
          {activeLessonId && lesson && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-zinc-900">{lesson.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{lesson.duration_minutes} min</p>
                </div>
                {!preview && (
                  <button
                    type="button"
                    onClick={() => completeMut.mutate(lesson.id)}
                    disabled={isCompleted || completeMut.isPending}
                    className={`px-3 py-2 rounded-xl text-sm font-black inline-flex items-center gap-1 ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700 cursor-default'
                        : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isCompleted ? 'Terminée' : 'Marquer comme terminée'}
                  </button>
                )}
              </div>

              <LessonViewer lesson={lesson} />

              {lesson.resources.length > 0 && (
                <div className="pt-3 border-t border-zinc-200">
                  <h4 className="text-xs font-black uppercase text-zinc-500 mb-2">Ressources</h4>
                  <ul className="space-y-1">
                    {lesson.resources.map((r) => (
                      <li key={r.id}>
                        <a
                          href={r.resource_url ?? r.file_path ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-bold text-primary-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Link2 className="w-3.5 h-3.5" /> {r.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function LessonViewer({ lesson }: { lesson: LessonDetail['lesson'] }) {
  if (lesson.lesson_type === 'video' && lesson.video_url) {
    const url = lesson.video_url;
    const isEmbed = /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
    if (isEmbed) {
      const embedUrl = toEmbedUrl(url);
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={lesson.title}
          />
        </div>
      );
    }
    return (
      <video src={url} controls className="w-full rounded-xl bg-black">
        Votre navigateur ne supporte pas la lecture vidéo.
      </video>
    );
  }

  if (lesson.lesson_type === 'pdf' && lesson.pdf_url) {
    return (
      <div className="aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200">
        <iframe src={lesson.pdf_url} className="w-full h-full" title={lesson.title} />
      </div>
    );
  }

  if (lesson.lesson_type === 'external_link' && lesson.external_url) {
    return (
      <a
        href={lesson.external_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white font-black text-sm"
      >
        <Link2 className="w-4 h-4" /> Ouvrir la ressource
      </a>
    );
  }

  if (lesson.content) {
    return (
      <div
        className="prose prose-sm max-w-none text-zinc-800"
        dangerouslySetInnerHTML={{ __html: lesson.content }}
      />
    );
  }

  return <p className="text-sm text-zinc-500">Pas de contenu disponible pour cette leçon.</p>;
}

function toEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.replace('/', '');
      return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    /* fallthrough */
  }
  return url;
}

export default MyLearningScreen;
