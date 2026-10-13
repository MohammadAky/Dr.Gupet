import '../styles/sample-records.css';

export function SampleRecordNotice({ kind }: { kind: 'product' | 'medicine' | 'pharmacy' }) {
  return (
    <p className="sample-record-note" role="note">
      <strong>نمونهٔ نمایشی</strong>
      {kind === 'product'
        ? 'این محصول برای نمایش طراحی است و قابل خرید نیست.'
        : kind === 'medicine'
          ? 'این مورد داروی واقعی یا توصیهٔ درمانی نیست.'
          : 'این مورد یک داروخانهٔ واقعی نیست؛ تماس یا موقعیت مکانی ندارد.'}
    </p>
  );
}
