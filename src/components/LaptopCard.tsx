import React from 'react';
// wishlist button moved to laptop detail page; keep card minimal

interface LaptopCardProps {
  laptop: any;
  onViewDetail: (l: any) => void;
  onBuyNow?: (l: any) => void;
  showCategories?: boolean;
}

const LaptopCardComponent: React.FC<LaptopCardProps> = ({ laptop, onViewDetail, onBuyNow, showCategories = true }) => {
  const id = laptop?.id;
  const name = laptop?.name || '';
  const imageUrl = laptop?.imageUrl || '';
  const galleryImages = laptop?.galleryImages || (imageUrl ? [imageUrl] : []);
  const price = Number(laptop?.price || 0);
  const formattedPrice = price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(price) : '-';
  const categories = laptop?.categories || [];

  // wishlist handled on the laptop detail page

  const createSnippet = (htmlContent: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent || '';
    const txt = tempDiv.textContent || tempDiv.innerText || '';
    return txt.slice(0, 180);
  };

  // Limit CPU badge to max 13 characters without ellipsis.
  // Strategy: build from space-separated tokens, but if a token contains a hyphen
  // prefer the part before the hyphen (e.g. 'i5-7300U' -> 'i5'). Stop adding tokens
  // when adding the next would exceed the limit. If no tokens fit, fall back to
  // a hard slice of the trimmed string.
  const formatCpu = (cpu: string) => {
    if (!cpu) return '';
    const trimmed = cpu.trim();
    const MAX = 13;
    if (trimmed.length <= MAX) return trimmed;

    const tokens = trimmed.split(/\s+/);
    let out = '';
    for (const t of tokens) {
      if (!t) continue;
      // prefer left side of hyphen if present
      const candidate = t.includes('-') ? t.split('-')[0] : t;
      const newLen = out ? out.length + 1 + candidate.length : candidate.length;
      if (newLen <= MAX) {
        out = out ? `${out} ${candidate}` : candidate;
      } else {
        // can't add candidate without exceeding MAX
        break;
      }
    }
    if (out) return out;
    // fallback: hard slice (no ellipsis)
    return trimmed.slice(0, MAX);
  };

  const snippet = createSnippet(laptop?.description || laptop?.longDescription || '');

  return (
    <article className="destination-card laptop-card" aria-labelledby={`laptop-title-${id}`} onClick={() => onViewDetail(laptop)}>
      <div className="card-image-container">
        <img src={galleryImages[0] || imageUrl} alt={name} loading="lazy" decoding="async" />
        {laptop?.condition && (
          <span className={`card-condition-badge card-condition-badge--${String(laptop.condition).toLowerCase()}`}>{String(laptop.condition).charAt(0).toUpperCase() + String(laptop.condition).slice(1)}</span>
        )}
      </div>
      <div className="card-content">
        {showCategories && categories.length > 0 && (
          <div className="card-category-list">{categories.slice(0,2).map((c:string) => <span key={c} className="card-category-badge">{c}</span>)}</div>
        )}
        <h3 id={`laptop-title-${id}`}>{name}</h3>
        <div className="card-specs-badges" aria-hidden>
          {/* Show only three spec badges: Processor (CPU), RAM, Storage */}
          {laptop?.cpu && <span className="card-spec-badge">{formatCpu(String(laptop.cpu))}</span>}
          {laptop?.ram && <span className="card-spec-badge">{laptop.ram}</span>}
          {laptop?.storage && <span className="card-spec-badge">{laptop.storage}</span>}
        </div>
        <div className="card-footer">
          <div>
            <span className="price-label">Harga</span>
            <p className="card-price">{formattedPrice}</p>
          </div>
        </div>
      </div>
    </article>
  );
};

export const LaptopCard = React.memo(LaptopCardComponent, (prevProps, nextProps) => {
  return prevProps.laptop?.id === nextProps.laptop?.id
    && prevProps.onViewDetail === nextProps.onViewDetail
    && prevProps.onBuyNow === nextProps.onBuyNow
    && prevProps.showCategories === nextProps.showCategories;
});

export default LaptopCard;
