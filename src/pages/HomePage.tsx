import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Destination, BlogPost, Page, HeroSlide, AppSettings } from '../types';
import { LaptopCard } from '../components/LaptopCard';
// destination cards removed from homepage per request
import { BlogCard } from '../components/BlogCard';
// destination skeleton removed
import BlogSkeleton from '../components/BlogSkeleton';
import { SearchIcon } from '../components/Icons';

interface HomePageProps {
    onSearch: (query: string) => void;
    onViewDetail: (destination: Destination) => void;
    onBookNow: (destination: Destination) => void;
    // Order flow removed; onCreateOrder intentionally omitted
    onViewBlogDetail: (post: BlogPost) => void;
    setPage: (page: Page) => void;
    destinations: Destination[];
    laptops: any[];
    blogPosts: BlogPost[];
    appSettings: AppSettings;
    isLoading?: boolean;
    reviews?: any[];
}
import ReviewCard from '../components/ReviewCard';
import ReviewSkeleton from '../components/ReviewSkeleton';
import Seo from '../components/Seo';

// Typing placeholder hook: cycles through phrases and types them into the input's placeholder
function useTypingPlaceholder(inputRef: React.RefObject<HTMLInputElement>, phrases: string[], typeSpeed = 80, pause = 2000) {
    const idxRef = React.useRef(0);
    const charRef = React.useRef(0);
    const timerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (!phrases || phrases.length === 0) return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const el = inputRef.current;
        if (!el) return;

        // bail out for data-saver / slow connections
        const nav = (navigator as any);
        const connection = nav && nav.connection;
        if (connection) {
            const saveData = !!connection.saveData;
            const slowTypes = ['slow-2g', '2g', '3g'];
            const effective = connection.effectiveType;
            if (saveData || (effective && slowTypes.includes(effective))) return;
        }

        // helper checks
        const isFocused = () => document.activeElement === el;
        const isHidden = () => document.hidden;

        // use IntersectionObserver to ensure hero is visible (avoid typing when offscreen)
        let heroVisible = true;
        const heroEl = el.closest && (el.closest('.hero') as HTMLElement | null);
        let io: IntersectionObserver | null = null;
        if (heroEl && 'IntersectionObserver' in window) {
            heroVisible = false;
            io = new IntersectionObserver((entries) => {
                heroVisible = entries.some(en => en.isIntersecting && en.intersectionRatio > 0);
            }, { threshold: 0.1 });
            io.observe(heroEl);
        }

        const loop = () => {
            if (!el) return;
            if (isHidden() || !heroVisible) {
                // defer while page hidden or hero not visible
                timerRef.current = window.setTimeout(loop, 1000);
                return;
            }
            if (isFocused() || (el as HTMLInputElement).value) {
                // pause typing while user is interacting with input
                timerRef.current = window.setTimeout(loop, 500);
                return;
            }

            const phrase = phrases[idxRef.current % phrases.length];
            if (charRef.current <= phrase.length) {
                el.placeholder = phrase.slice(0, charRef.current);
                charRef.current++;
                timerRef.current = window.setTimeout(loop, typeSpeed);
            } else {
                // finished typing one phrase, wait then clear and next
                timerRef.current = window.setTimeout(() => {
                    charRef.current = 0;
                    idxRef.current++;
                    // small delay before typing next
                    timerRef.current = window.setTimeout(loop, 200);
                }, pause);
            }
        };

        loop();

        return () => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            if (io && heroEl) io.unobserve(heroEl);
            if (el) el.placeholder = '';
        };
    }, [inputRef, phrases, typeSpeed, pause]);
}

const Hero = ({ onSearch, slides, categories }: { onSearch: (query: string) => void; slides: HeroSlide[]; categories?: string[] }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isFading, setIsFading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    
    const activeSlides = slides && slides.length > 0 ? slides : [{id: 0, title: 'Selamat Datang', subtitle: 'Atur hero section dari dashboard admin.', imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=2070&auto=format&fit=crop' }];

    // derive phrases from categories (unique, non-empty)
    const phrases = useMemo(() => {
        if (!categories || categories.length === 0) return ['Cari destinasi, misal: Bali'];
        const unique = Array.from(new Set(categories.map(s => (s || '').trim()).filter(Boolean)));
        if (unique.length === 0) return ['Cari destinasi, misal: Bali'];
        // limit to reasonable number to avoid long cycles
        return unique.slice(0, 12);
    }, [categories]);

    // attach typing placeholder to input
    useTypingPlaceholder(inputRef, phrases, 70, 2200);


    useEffect(() => {
        if (activeSlides.length <= 1) return;
        const timer = setTimeout(() => {
            setIsFading(true);
            setTimeout(() => {
                setCurrentSlide((prevSlide) => (prevSlide + 1) % activeSlides.length);
                setIsFading(false);
            }, 500); // Corresponds to CSS transition duration
        }, 5000); // Time between slide changes

        return () => clearTimeout(timer);
    }, [currentSlide, activeSlides.length]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            onSearch(searchTerm.trim());
        }
    };

    return (
        <section className="hero">
            {activeSlides.map((slide, index) => (
                <div
                    key={slide.id}
                    className={`hero-slide ${index === currentSlide ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${slide.imageUrl})` }}
                    aria-hidden={index !== currentSlide}
                ></div>
            ))}
            <div className="hero-overlay"></div>
            <div className="container hero-content">
                <div className={`hero-text-content ${isFading ? 'fade' : ''}`}>
                    <h1>{activeSlides[currentSlide].title}</h1>
                    <p>{activeSlides[currentSlide].subtitle}</p>
                </div>
                <form className="search-bar" onSubmit={handleSearchSubmit}>
                    <input 
                        ref={inputRef}
                        type="text" 
                        aria-label="Cari destinasi"
                        placeholder="" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onFocus={() => {
                            // clear placeholder immediately on focus to avoid distraction
                            if (inputRef.current) inputRef.current.placeholder = '';
                        }}
                        onBlur={() => {
                            // no-op: typing hook will resume and re-populate placeholder when appropriate
                        }}
                    />
                    <button type="submit" aria-label="Cari">
                        <SearchIcon />
                    </button>
                </form>
            </div>
        </section>
    );
};

// Destination sections removed from homepage per request


const BlogSection = ({ blogPosts, setPage, onViewDetail, isLoading }: { blogPosts: BlogPost[], setPage: (page: Page) => void, onViewDetail: (post: BlogPost) => void, isLoading?: boolean }) => {
    const navigate = useNavigate();
    return (
    <section className="blog-section">
        <div className="container">
            <div className="section-header">
                <h2>Blog & Berita Terbaru</h2>
                <p>Dapatkan inspirasi, tips, dan berita terbaru dari dunia traveling.</p>
            </div>
            <div className="blog-grid homepage-blog-grid">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <BlogSkeleton key={i} />)
                ) : (blogPosts && blogPosts.length > 0 ? (
                    blogPosts.slice(0, 4).map(post => <BlogCard key={post.id} post={post} onViewDetail={onViewDetail} />)
                ) : (
                    <div className="no-results" style={{ padding: '1rem 0' }}>
                        <p>Belum ada artikel. Tambahkan artikel dari dashboard admin.</p>
                    </div>
                ))}
            </div>
            <div className="section-footer">
                <button className="btn btn-primary" onClick={() => { navigate('/blog'); try { setPage && setPage('blog'); } catch {} }}>Lihat Semua Artikel</button>
            </div>
        </div>
    </section>
    );
}

export const HomePage: React.FC<HomePageProps> = ({ onSearch, onViewDetail, onBookNow, onViewBlogDetail, setPage, destinations, laptops = [], blogPosts, appSettings, isLoading = false, reviews = [] }) => {
    // derive categories from destinations to feed the hero typing placeholder
    const categories = React.useMemo(() => {
        if (!destinations) return [] as string[];
        return Array.from(new Set(destinations.flatMap(d => d.categories || [])));
    }, [destinations]);

    // derive product names from laptops to use as typing phrases in the hero search
    const productNames = React.useMemo(() => {
        try {
            if (!laptops || laptops.length === 0) return [] as string[];
            const names = Array.from(new Set(laptops.map((l: any) => (l?.name || '').trim()).filter(Boolean)));
            return names.slice(0, 12);
        } catch (e) { return [] as string[]; }
    }, [laptops]);

    const [activeBookingDest, setActiveBookingDest] = useState<Destination | null>(null);
    const navigate = useNavigate();

    const openBookingFromCard = (dest: Destination) => {
        try { onBookNow && onBookNow(dest); } catch { /* ignore */ }
    };

    return (
        <>
            <Seo
                title={`${appSettings?.brandName || 'TravelGo'} - ${appSettings?.tagline || 'Temukan destinasi impian Anda'}`}
                description={appSettings?.tagline || 'Temukan destinasi impian Anda bersama kami.'}
                url={window.location.href}
                image={appSettings?.logoLightUrl || undefined}
                siteName={appSettings?.brandName || 'TravelGo'}
            />
            <Hero onSearch={onSearch} slides={appSettings.heroSlides} categories={productNames.length ? productNames : categories} />
            {/* Destinations sections removed from homepage per request */}

            {/* Laptop products section */}
            <section className="laptops-section" style={{ padding: '40px 0' }}>
                <div className="container">
                    <div className="section-header">
                        <h2>Produk Laptop</h2>
                        <p>Temukan laptop pilihan kami dengan spesifikasi lengkap.</p>
                    </div>
                    <div className="destinations-grid homepage-grid">
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: 220, background: 'var(--bg-secondary)', borderRadius: 8 }} />)
                        ) : (laptops && laptops.length > 0 ? (
                            laptops.slice(0, 6).map((l: any) => (
                                <LaptopCard
                                    key={l.id}
                                    laptop={l}
                                    showCategories={true}
                                    onViewDetail={(lp: any) => {
                                        try { setPage && setPage('laptopDetail'); } catch {}
                                        try { navigate(`/laptops/${lp.slug || lp.id}`); } catch {}
                                    }}
                                />
                            ))
                        ) : (
                            <div className="no-results" style={{ padding: '1rem 0' }}>
                                <p>Belum ada produk laptop. Tambahkan dari dashboard admin.</p>
                            </div>
                        ))}
                    </div>
                    {laptops && laptops.length > 6 && (
                        <div className="section-footer">
                            <button className="btn btn-primary" onClick={() => { try { setPage && setPage('laptops'); } catch {} }}>Lihat Semua Produk</button>
                        </div>
                    )}
                </div>
            </section>
            {blogPosts && blogPosts.length > 0 && (
                <BlogSection blogPosts={blogPosts} setPage={setPage} onViewDetail={onViewBlogDetail} isLoading={isLoading} />
            )}
            {reviews && reviews.length > 0 && (
                <section className="reviews-section" style={{ padding: '60px 0' }}>
                    <div className="container">
                        <div className="section-header">
                            <h2>Ulasan Pengunjung</h2>
                            <p>Apa kata mereka tentang pengalaman wisata.</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
                                            {isLoading ? (
                                                Array.from({ length: 3 }).map((_, i) => <ReviewSkeleton key={i} />)
                                            ) : (
                                                (reviews || []).slice(0, 8).map(r => <ReviewCard key={r.id} name={r.name} initials={r.initials} content={r.content} created_at={r.created_at} rating={r.rating} />)
                                            )}
                        </div>
                    </div>
                </section>
            )}
            {/* Booking is now handled by /order page */}
        </>
    );
};

// Render booking modal when a card requests booking
// (Placed after component to keep render logic minimal)
// NOTE: This is intentionally inside the component's return fragment via activeBookingDest

// ...existing code...
