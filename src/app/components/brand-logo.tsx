// A Pro freelancer's uploaded logo. Plain <img>: it is a small, already-sized file from our own /brand route,
// so next/image optimisation would add a processing step for no gain.
export function BrandLogo({ accountId, version, alt, className }: { accountId: string; version: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={`/brand/${accountId}?v=${encodeURIComponent(version)}`} alt={alt}/>;
}
