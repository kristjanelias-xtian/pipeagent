import { useCompanyProfile } from '../hooks/useCompanyProfile';

export function DemoBanner() {
  const { profile } = useCompanyProfile();
  if (!profile?.name) return null;
  return (
    <div className="bg-[var(--color-primary-dark)] text-white text-center text-xs py-1.5 flex-shrink-0">
      TEX demo -- {profile.name}
    </div>
  );
}
