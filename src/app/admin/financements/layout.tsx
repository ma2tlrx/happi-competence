import { LinkTabs } from '@/components/ui/navigation';

const TABS = [
  { href: '/admin/financements', label: 'Conventions', exact: true },
  { href: '/admin/financements/financeurs', label: 'Financeurs' },
  { href: '/admin/financements/bpf', label: 'Bilan pédagogique et financier' },
];

export default function FundingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LinkTabs tabs={TABS} label="Rubriques financements" className="mb-6" />
      {children}
    </>
  );
}
