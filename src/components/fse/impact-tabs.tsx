import { LinkTabs } from '@/components/ui/navigation';

/** Onglets d'Admin › Impact. */
export function ImpactTabs() {
  return (
    <LinkTabs
      label="Vues du tableau de bord d’impact"
      className="mb-6"
      tabs={[
        { href: '/admin/impact', label: 'Vue d’ensemble', exact: true },
        { href: '/admin/impact/fse', label: 'FSE+' },
      ]}
    />
  );
}
