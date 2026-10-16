import { Link } from 'react-router-dom';
import '../styles/commerce-checkout-experience.css';

export type CommerceStage = 'cart' | 'delivery' | 'payment';
const stages = [
  { id: 'cart', label: 'سبد خرید' },
  { id: 'delivery', label: 'تحویل' },
  { id: 'payment', label: 'پرداخت' },
] as const;

export function CommerceSteps({ current }: { current: CommerceStage }) {
  const active = stages.findIndex(stage => stage.id === current);
  return <ol className="commerce-steps" aria-label="مراحل خرید">
    {stages.map((stage, index) => <li key={stage.id} aria-current={stage.id === current ? 'step' : undefined} data-complete={index < active}>
      <span className="commerce-steps__number" aria-hidden="true">{index < active ? '✓' : (index + 1).toLocaleString('fa-IR')}</span>
      {stage.id === 'cart' && active > 0 ? <Link to="/cart">{stage.label}</Link> : <span>{stage.label}</span>}
    </li>)}
  </ol>;
}
