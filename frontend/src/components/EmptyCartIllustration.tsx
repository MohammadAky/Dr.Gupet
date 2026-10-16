import '../styles/commerce-checkout-experience.css';

/** Original decorative basket artwork, authored for this project. */
export function EmptyCartIllustration() {
  return <div className="commerce-empty-art" aria-hidden="true">
    <svg viewBox="0 0 320 260" fill="none" focusable="false">
      <ellipse cx="160" cy="221" rx="90" ry="11" fill="currentColor" opacity=".08" />
      <circle cx="160" cy="128" r="106" fill="currentColor" opacity=".04" />
      <g className="commerce-empty-art__basket">
        <path d="M111 119 140 66M209 119 180 66" stroke="var(--forest-soft)" strokeWidth="9" strokeLinecap="round" />
        <path d="m78 123 20 77a12 12 0 0 0 12 9h100a12 12 0 0 0 12-9l20-77" fill="var(--gold-soft)" stroke="var(--forest-soft)" strokeWidth="5" />
        <rect x="70" y="112" width="180" height="20" rx="10" fill="var(--glass-solid, var(--paper))" stroke="var(--forest-soft)" strokeWidth="5" />
        <path d="M124 151v34M160 151v34M196 151v34" stroke="var(--gold)" strokeWidth="7" strokeLinecap="round" />
      </g>
      <path d="M265 61v16M257 69h16M63 65v10M58 70h10" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>;
}
