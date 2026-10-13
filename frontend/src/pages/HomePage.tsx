import { LandingBanner } from '../components/LandingBanner';
import { LandingSections } from '../components/LandingSections';
import '../styles/landing-sections.css';

export function HomePage() {
  return (
    <div className="home-page landing-page">
      <LandingBanner />
      <LandingSections />
    </div>
  );
}
