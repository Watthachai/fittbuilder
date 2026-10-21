/* eslint-disable @next/next/no-img-element */

/**
 * A shot drawn at card size: the resized picture from `thumbUrls`, fetched only
 * when the card scrolls near. Until its link is signed the card stays a white
 * frame of the same size, so the grid does not jump when the pictures arrive.
 */
export default function ShotThumb({ src, alt, className }: { src: string | undefined; alt: string; className: string }) {
  if (!src) return <div aria-hidden className={className} />;
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}
