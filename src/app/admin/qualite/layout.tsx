import { LinkTabs } from '@/components/ui/navigation';

const TABS = [
  { href: '/admin/qualite', label: 'Indicateurs', exact: true },
  { href: '/admin/qualite/reclamations', label: 'Réclamations' },
  { href: '/admin/qualite/amelioration', label: 'Plan d’amélioration' },
  { href: '/admin/qualite/intervenants', label: 'Intervenants' },
  { href: '/admin/qualite/veille', label: 'Veille' },
];

export default function QualityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LinkTabs tabs={TABS} label="Rubriques qualité" className="mb-6" />
      {children}
    </>
  );
}
