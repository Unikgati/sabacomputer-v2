import React, { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import Seo from '../components/Seo';
import Loading from '../components/Loading';
import { useWishlist } from '../contexts/WishlistContext';
import { HeartIcon } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

interface LaptopDetailPageProps {
  laptop: any;
  setPage?: (p: any) => void;
  onBuyNow?: (l: any) => void;
}

export const LaptopDetailPage: React.FC<LaptopDetailPageProps> = ({ laptop, setPage, onBuyNow }) => {
  const [isLoading, setIsLoading] = useState(true);
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const isWishlisted = isInWishlist(laptop?.id);
  const imgs = useMemo(() => (Array.isArray(laptop.galleryImages) && laptop.galleryImages.length > 0) ? laptop.galleryImages : (laptop.imageUrl ? [laptop.imageUrl] : []), [laptop.galleryImages, laptop.imageUrl]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const mainImageContainerRef = useRef<HTMLDivElement | null>(null);
  // drag/gesture state for swipe support
  const [dragX, setDragX] = useState<number>(0);
  const dragXRef = useRef<number>(0);
  const mainImageTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mainImageTouchEndRef = useRef<{ x: number; y: number } | null>(null);
  const animTimeoutRef = useRef<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const ANIM_DURATION = 240; // ms
  useEffect(() => { const t = setTimeout(() => setIsLoading(false), 300); return () => clearTimeout(t); }, []);

  const formattedPrice = laptop && laptop.price ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(laptop.price) : '-';

  useEffect(() => { window.scrollTo(0,0); try { document.title = laptop.name || 'Laptop'; } catch (e) {} }, [laptop.name]);

  // keyboard navigation for left/right arrows
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentIndex(i => (imgs.length ? (i - 1 + imgs.length) % imgs.length : 0));
      } else if (e.key === 'ArrowRight') {
        setCurrentIndex(i => (imgs.length ? (i + 1) % imgs.length : 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [imgs.length]);

  if (isLoading) return <div className="page-container"><div className="container"><Loading message="Memuat..." size="large" /></div></div>;

  return (
    <div className="page-container laptop-detail-page">
      <Seo title={`${laptop.name} - ${document.title || ''}`} description={(laptop.description || '').slice(0,160)} url={window.location.href} image={laptop.imageUrl} siteName={document.title || ''} />
      <div className="container">
        <div className="page-header-with-back">
          <h1>{laptop.name}</h1>
        </div>

        

        <div className="laptop-detail-grid">
          <div className="left-column">
            <section className="gallery-container">
              <div className="main-image square" ref={(el) => (mainImageContainerRef.current = el)}>
                <button
                  className={`wishlist-btn ${isWishlisted ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); if (isWishlisted) removeFromWishlist(laptop?.id); else addToWishlist(laptop?.id); }}
                  aria-label={isWishlisted ? `Hapus ${laptop?.name} dari wishlist` : `Tambah ${laptop?.name} ke wishlist`}
                >
                  <HeartIcon filled={isWishlisted} />
                </button>
                {imgs.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="image-nav image-nav-left"
                      onClick={() => setCurrentIndex(i => (imgs.length ? (i - 1 + imgs.length) % imgs.length : 0))}
                      aria-label="Gambar sebelumnya"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="image-nav image-nav-right"
                      onClick={() => setCurrentIndex(i => (imgs.length ? (i + 1) % imgs.length : 0))}
                      aria-label="Gambar berikutnya"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
                        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </>
                )}
                <div
                  className="main-image-track"
                  onTouchStart={(e) => {
                    if (isAnimating) return;
                    const t = e.touches[0];
                    mainImageTouchStartRef.current = { x: t.clientX, y: t.clientY };
                    mainImageTouchEndRef.current = null;
                    if (animTimeoutRef.current) window.clearTimeout(animTimeoutRef.current);
                  }}
                  onTouchMove={(e) => {
                    if (isAnimating) return;
                    const start = mainImageTouchStartRef.current;
                    if (!start) return;
                    const t = e.touches[0];
                    const dx = t.clientX - start.x;
                    setDragX(dx);
                    dragXRef.current = dx;
                    mainImageTouchEndRef.current = { x: t.clientX, y: t.clientY };
                  }}
                  onTouchEnd={() => {
                    if (isAnimating) return;
                    const start = mainImageTouchStartRef.current;
                    const end = mainImageTouchEndRef.current;
                    if (!start) { setDragX(0); return; }
                    const dx = (end ? end.x : start.x) - start.x;
                    const dy = end ? end.y - start.y : 0;
                    const absDx = Math.abs(dx);
                    const absDy = Math.abs(dy);
                    const SWIPE_THRESHOLD = 40; // px
                    if (absDx > SWIPE_THRESHOLD && absDx > absDy) {
                      if (dx < 0) {
                        setCurrentIndex(i => Math.min(imgs.length - 1, i + 1));
                      } else {
                        setCurrentIndex(i => Math.max(0, i - 1));
                      }
                    }
                    // snap animation
                    setIsAnimating(true);
                    setDragX(0);
                    animTimeoutRef.current = window.setTimeout(() => {
                      setIsAnimating(false);
                      animTimeoutRef.current = null;
                    }, ANIM_DURATION);
                    mainImageTouchStartRef.current = null;
                    mainImageTouchEndRef.current = null;
                  }}
                  style={{
                    transform: `translateX(${ -currentIndex * 100 + (dragX / (mainImageContainerRef.current?.clientWidth || window.innerWidth)) * 100 }%)`,
                    transition: isAnimating ? `transform ${ANIM_DURATION}ms ease` : 'none'
                  }}
                >
                  {imgs.map((src:string, idx:number) => (
                    <div key={idx} className={`main-image-slide ${idx === currentIndex ? 'active' : ''}`} style={{ backgroundImage: `url(${src})` }} />
                  ))}
                </div>
              </div>
              <div className="thumbnail-grid">
                {imgs.map((img:string, idx:number) => (
                  <button key={idx} className={`thumbnail ${idx === currentIndex ? 'active' : ''}`} onClick={() => setCurrentIndex(idx)} aria-label={`Lihat gambar ${idx+1}`}>
                    <img src={img} alt={`Thumbnail ${idx+1}`} loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            </section>
          </div>
          <aside className="right-column">
            <div className="specs-card specs-card--shadow" style={{ marginTop: 0 }}>
              <div className="specs-card-header">
                <h3>Spesifikasi</h3>
              </div>
              <table className="specs-table">
                <tbody>
                  {[
                    ['RAM', laptop.ram || '-'],
                    ['Storage', laptop.storage || '-'],
                    ['CPU', laptop.cpu || '-'],
                    ['Layar', laptop.displayInch ? `${laptop.displayInch} inch` : '-'],
                    ['Kondisi', laptop.condition || '-'],
                    ['Grade', laptop.grade || '-'],
                  ].map(([k, v], i) => (
                    <tr key={String(k)} className="specs-row">
                      <th className="specs-key">{k}</th>
                      <td className="specs-val">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(laptop.features && laptop.features.length > 0) && (
                <section className="features-section">
                  <h3>Kelebihan</h3>
                  <div className="features-badges" aria-label="Kelebihan">
                    {(laptop.features || []).map((f:string, i:number) => (
                      <span key={i} className="feature-badge" title={f}>{f}</span>
                    ))}
                  </div>
                </section>
              )}

              {(laptop.accessories && laptop.accessories.length > 0) && (
                <section className="accessories-section">
                  <h3>Kelengkapan</h3>
                  <div className="accessories-badges" aria-label="Kelengkapan">
                    {(laptop.accessories || []).map((a:string, i:number) => (
                      <span key={i} className="accessory-badge" title={a}>{a}</span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </div>

        {/* keyboard navigation: left/right arrows to change images */}
        <script>{/* placeholder to keep JSX prettier; real handler is attached via useEffect below */}</script>

  {/* Description: place after grid so it spans full width */}
  <div className="blog-detail-content" style={{ marginTop: '1.5rem' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(laptop.description || '') }} />
      </div>

      {/* Sticky buy bar (similar to destination) */}
      <div className="sticky-booking-bar">
        <div className="container booking-bar-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span className="booking-price-label">Harga</span>
            <span className="booking-price" style={{ display: 'block', fontSize: '1.125rem', fontWeight: 700 }}>{formattedPrice}</span>
          </div>
          <div>
            {/* WhatsApp chat button: build URL from appSettings in localStorage with a custom message */}
            {(() => {
              let whatsappNumber = '';
              try {
                const stored = localStorage.getItem('appSettings');
                if (stored) {
                  const parsed = JSON.parse(stored);
                  whatsappNumber = parsed?.whatsappNumber || parsed?.whatsappnumber || '';
                }
              } catch (e) { /* ignore and fallback */ }
              // fallback default
              if (!whatsappNumber) whatsappNumber = '6281234567890';
              const clean = String(whatsappNumber).replace(/\D/g, '');
              const message = `Saya ingin bertanya tentang ${laptop?.name || 'produk'} ini. -www.sabacomputer.com-`;
              const url = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
              return (
                <a href={url} className="btn btn-primary btn-large" target="_blank" rel="noopener noreferrer">Chat</a>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaptopDetailPage;
