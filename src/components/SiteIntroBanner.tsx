import { SiteIntroContent } from '../content/siteIntro';

export interface SiteIntroBannerProps {
  onDismiss: () => void;
}

export function SiteIntroBanner({ onDismiss }: SiteIntroBannerProps) {
  return (
    <section
      className="site-intro-banner"
      aria-labelledby="site-intro-banner-title"
    >
      <div className="site-intro-banner__inner">
        <h2 id="site-intro-banner-title" className="site-intro-banner__title">
          What this site is
        </h2>
        <button
          type="button"
          className="site-intro-banner__close"
          onClick={onDismiss}
          aria-label="Dismiss site introduction"
        >
          ×
        </button>
      </div>
      <div className="site-intro-banner__body">
        <SiteIntroContent />
      </div>
    </section>
  );
}
