import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import * as api from '../lib/api';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/ui/EmptyState';

type DashboardCards = {
  total_students: number;
  active_students: number;
  courses: number;
  revenue: number;
  completion_rate: number;
  certificates_issued: number;
};

type DashboardPayload = {
  cards: DashboardCards;
};

type AcademyPageEntry = {
  key: string;
  title: string;
  description: string;
};

export function AcademyScreen() {
  const toast = useToast();
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<DashboardPayload>('academy/reports/dashboard');
    setLoading(false);
    if (!res.ok || !res.data) {
      toast.error(res.message);
      setCards(null);
      return;
    }
    setCards(res.data.cards);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages: AcademyPageEntry[] = [
    { key: 'dashboard', title: 'Academy Dashboard', description: 'Vue globale des KPIs, activite et performance.' },
    { key: 'courses', title: 'Courses List', description: 'Gestion des cours, statuts draft/publish/archive et categories.' },
    { key: 'course-builder', title: 'Course Builder', description: 'Construction de cours (sections, lessons, resources).' },
    { key: 'students', title: 'Students', description: 'Profils et progression des apprenants.' },
    { key: 'enrollments', title: 'Enrollments', description: 'Inscriptions free, paid, manual ou bulk.' },
    { key: 'quizzes', title: 'Quizzes', description: 'Questionnaires, tentatives et correction.' },
    { key: 'certificates', title: 'Certificates', description: 'Emission PDF, verification QR et historique.' },
    { key: 'payments', title: 'Payments', description: 'Transactions Stripe, virement et validation manuelle.' },
    { key: 'reports', title: 'Reports', description: 'Rapports de performance et export.' },
    { key: 'settings', title: 'Settings', description: 'Configuration LMS, notifications et templates.' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brandna Academy"
        subtitle="LMS multi-marque pour creer, vendre et delivrer des formations."
      />

      {cards ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <article className="card p-4">
            <p className="text-xs uppercase font-bold text-zinc-400">Total Students</p>
            <p className="text-2xl font-black text-zinc-900">{cards.total_students}</p>
          </article>
          <article className="card p-4">
            <p className="text-xs uppercase font-bold text-zinc-400">Active Students</p>
            <p className="text-2xl font-black text-zinc-900">{cards.active_students}</p>
          </article>
          <article className="card p-4">
            <p className="text-xs uppercase font-bold text-zinc-400">Courses</p>
            <p className="text-2xl font-black text-zinc-900">{cards.courses}</p>
          </article>
          <article className="card p-4">
            <p className="text-xs uppercase font-bold text-zinc-400">Revenue</p>
            <p className="text-2xl font-black text-zinc-900">${cards.revenue.toFixed(2)}</p>
          </article>
          <article className="card p-4">
            <p className="text-xs uppercase font-bold text-zinc-400">Completion Rate</p>
            <p className="text-2xl font-black text-zinc-900">{cards.completion_rate}%</p>
          </article>
          <article className="card p-4">
            <p className="text-xs uppercase font-bold text-zinc-400">Certificates Issued</p>
            <p className="text-2xl font-black text-zinc-900">{cards.certificates_issued}</p>
          </article>
        </div>
      ) : null}

      {pages.length === 0 && !loading ? (
        <EmptyState title="Aucun module academy" description="Activez les permissions academy pour afficher les pages LMS." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pages.map((page) => (
            <article key={page.key} className="card p-5 space-y-2">
              <h3 className="font-black text-zinc-900">{page.title}</h3>
              <p className="text-sm text-zinc-700">{page.description}</p>
              <p className="text-xs font-bold uppercase text-primary-600">Coming next in Academy workspace</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
