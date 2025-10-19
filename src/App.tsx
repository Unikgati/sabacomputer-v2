import React, { useState, useEffect, Suspense } from 'react';
import { ToastProvider } from './components/Toast';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { WishlistProvider } from './contexts/WishlistContext';
import { fetchDestinations, upsertDestination, deleteDestination as sbDeleteDestination, fetchBlogPosts, upsertBlogPost, deleteBlogPost as sbDeleteBlogPost, fetchAppSettings, upsertAppSettings, fetchReviews } from './lib/supabase';
import { Page, Destination, BlogPost, AppSettings } from './types';
import getSupabaseClient from './lib/supabase';
// Removed demo seed data import to rely solely on Supabase (or empty state)
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StickyWhatsAppButton } from './components/StickyWhatsAppButton';
import { HomePage } from './pages/HomePage';
import { DestinationsPage } from './pages/DestinationsPage';
import { DestinationDetailPage } from './pages/DestinationDetailPage';
import { BlogPage } from './pages/BlogPage';
import { BlogDetailPage } from './pages/BlogDetailPage';
import { LaptopsPage } from './pages/LaptopsPage';
import { LaptopDetailPage } from './pages/LaptopDetailPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { WishlistPage } from './pages/WishlistPage';
import { ContactPage } from './pages/ContactPage';
import ReviewsPage from './pages/ReviewsPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import Loading from './components/Loading';
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout').then(module => ({ default: module.AdminLayout })));
// Order and invoice pages removed
import ThemeContext, { Theme, ThemeProvider } from './contexts/ThemeContext';

// Function to lighten/darken a color
const shadeColor = (color: string, percent: number) => {
    let R = parseInt(color.substring(1,3),16);
    let G = parseInt(color.substring(3,5),16);
    let B = parseInt(color.substring(5,7),16);

    R = Math.min(255, Math.floor(R * (100 + percent) / 100));
    G = Math.min(255, Math.floor(G * (100 + percent) / 100));
    B = Math.min(255, Math.floor(B * (100 + percent) / 100));

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return `#${RR}${GG}${BB}`;
}

const App = () => {
  const [page, setPage] = useState<Page>('home');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [homeIsLoading, setHomeIsLoading] = useState(false);
  const [supabaseFetchStatus, setSupabaseFetchStatus] = useState<{ destinations?: string; blog?: string }>({});

  // Simulate initial home load for preview/demo of skeletons (1.5s)
  useEffect(() => {
    setHomeIsLoading(true);
    const t = setTimeout(() => setHomeIsLoading(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // Sync isAuthenticated with Supabase session
  useEffect(() => {
    const supabase = getSupabaseClient();
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data?.session) setIsAuthenticated(true);
      } catch (e) {
        // ignore
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const signedIn = !!session;
      setIsAuthenticated(signedIn);
      // When a SIGNED_IN event occurs, trigger a deterministic refresh so admin
      // immediately sees up-to-date collections (orders/destinations/blog).
      // Use a microtask so auth state has settled in the client.
      if (event === 'SIGNED_IN') {
        // Fire-and-forget refresh; handleRefresh is resilient if Supabase isn't configured
        Promise.resolve().then(() => { try { handleRefresh(); } catch (e) { /* ignore */ } });
      }
    });

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch {}
    };
  }, []);
  
  // Data moved to state for mutability. Start empty so UI reflects Supabase state.
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [laptops, setLaptops] = useState<any[]>([]);

  // If Supabase env is configured, load remote data on mount
  useEffect(() => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!useSupabase) return;

    let mounted = true;
    (async () => {
  try {
    const [remoteDestinations, remoteBlog, remoteReviews, remoteLaptops] = await Promise.all([fetchDestinations(), fetchBlogPosts(), fetchReviews(), (async () => { try { const mod = await import('./lib/supabase'); return (mod as any).fetchLaptops ? (mod as any).fetchLaptops() : []; } catch { return []; } })()]);
    if (!mounted) return;
        // Always apply remote results even when empty arrays are returned. This ensures
        // the app mirrors Supabase state (empty) instead of silently keeping local seed data.
  if (Array.isArray(remoteDestinations)) {
    // debug log removed in production build
          setDestinations(remoteDestinations as unknown as Destination[]);
          setSupabaseFetchStatus(prev => ({ ...prev, destinations: `ok (${remoteDestinations.length})`}));
        } else {
          // debug log removed in production build
          setSupabaseFetchStatus(prev => ({ ...prev, destinations: 'invalid-shape' }));
        }

  if (Array.isArray(remoteBlog)) {
          // debug log removed in production build
          setBlogPosts(remoteBlog as unknown as BlogPost[]);
          setSupabaseFetchStatus(prev => ({ ...prev, blog: `ok (${remoteBlog.length})`}));
        } else {
          // debug log removed in production build
          setSupabaseFetchStatus(prev => ({ ...prev, blog: 'invalid-shape' }));
        }
  // orders removed
        if (Array.isArray(remoteReviews)) {
          setReviews(remoteReviews || []);
          setSupabaseFetchStatus(prev => ({ ...prev, reviews: `ok (${remoteReviews.length})`}));
        }
        if (Array.isArray(remoteLaptops)) {
          setLaptops(remoteLaptops || []);
          setSupabaseFetchStatus(prev => ({ ...prev, laptops: `ok (${remoteLaptops.length})`}));
        }
      } catch (err) {
        console.warn('Supabase fetch failed, keeping local seed data', err);
        setSupabaseFetchStatus({ destinations: 'error', blog: 'error' });
      }
    })();
    return () => { mounted = false; };
  }, []);

  // App Settings State - initialize synchronously from localStorage to avoid FOUC
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
      theme: 'light',
      accentColor: '#3182ce',
      brandName: '',
      tagline: 'Jelajahi dunia tanpa batas.',
      logoLightUrl: '',
      logoDarkUrl: '',
      favicon16Url: '',
      favicon192Url: '',
      favicon512Url: '',
      email: 'contact@travelgo.com',
      address: 'Jl. Jend. Sudirman No. 123, Jakarta Pusat, Indonesia',
      whatsappNumber: '6281234567890',
      facebookUrl: '',
      instagramUrl: '',
      twitterUrl: '',
      bankName: '',
      bankAccountNumber: '',
      bankAccountHolder: '',
      heroSlides: [],
    };

    try {
      let stored: string | null = null;
      try { stored = localStorage.getItem('appSettings'); } catch (e) { stored = null; }
      let theme: string | null = null;
      try { theme = localStorage.getItem('theme'); } catch (e) { theme = null; }

      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...defaultSettings, ...parsed, theme: theme ?? parsed?.theme ?? defaultSettings.theme } as AppSettings;
        } catch (e) {
          return { ...defaultSettings, theme: theme ?? defaultSettings.theme };
        }
      }

      if (theme) return { ...defaultSettings, theme };
      return defaultSettings;
    } catch (e) {
      return {
        theme: 'light',
        accentColor: '#3182ce',
        brandName: '',
        tagline: 'Jelajahi dunia tanpa batas.',
        logoLightUrl: '',
        logoDarkUrl: '',
        favicon16Url: '',
        favicon192Url: '',
        favicon512Url: '',
        email: 'contact@travelgo.com',
        address: 'Jl. Jend. Sudirman No. 123, Jakarta Pusat, Indonesia',
        whatsappNumber: '6281234567890',
        facebookUrl: '',
        instagramUrl: '',
        twitterUrl: '',
        bankName: '',
        bankAccountNumber: '',
        bankAccountHolder: '',
        heroSlides: [],
      };
    }
  });

  // runtime theme is handled by ThemeProvider

  // Load settings from localStorage on initial render
  useEffect(() => {
    let mounted = true;
    const storedSettings = (() => {
      try { return localStorage.getItem('appSettings'); } catch { return null; }
    })();
    const storedTheme = (() => {
      try { return localStorage.getItem('theme'); } catch { return null; }
    })();

    // If user has a saved theme preference in localStorage, copy it into appSettings.theme so admin can persist it
    if (storedTheme) {
      try { setAppSettings(prev => ({ ...prev, theme: storedTheme as any })); } catch {}
    }

    // If Supabase configured, attempt to load settings from DB first. Otherwise fallback to localStorage.
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      if (storedSettings) {
        try { setAppSettings(prev => ({ ...prev, ...JSON.parse(storedSettings) })); } catch (e) { console.error('Failed to parse app settings from localStorage', e); }
      }
      return;
    }

    (async () => {
      try {
        const remote = await fetchAppSettings();
        if (!mounted) return;
        if (remote) {
          // Preserve locally saved theme preference if present (localStorage is intentionally primary)
          setAppSettings(prev => ({ ...prev, ...remote, theme: storedTheme ?? remote.theme ?? prev.theme }));
          try { localStorage.setItem('appSettings', JSON.stringify(remote)); } catch {}
        } else if (storedSettings) {
          // fallback to localStorage if remote missing or access denied
          try { setAppSettings(prev => ({ ...prev, ...JSON.parse(storedSettings) })); } catch (e) { console.error('Failed to parse app settings from localStorage', e); }
        }
      } catch (err) {
        console.warn('[SUPABASE] failed to load app settings, falling back to localStorage', err);
        if (storedSettings) {
          try { setAppSettings(prev => ({ ...prev, ...JSON.parse(storedSettings) })); } catch (e) { console.error('Failed to parse app settings from localStorage', e); }
        }
      }
    })();

    return () => { mounted = false; };
  }, []);

  // Debug instrumentation: wrap history methods to log who is calling navigation
  useEffect(() => {
    try {
      const originalPush = window.history.pushState;
      const originalReplace = window.history.replaceState;

      // @ts-ignore
      window.history.pushState = function (...args: any[]) {
  // debug instrumentation removed for production
        // @ts-ignore
        return originalPush.apply(this, args);
      };

      // @ts-ignore
      window.history.replaceState = function (...args: any[]) {
  // debug instrumentation removed for production
        // @ts-ignore
        return originalReplace.apply(this, args);
      };

      return () => {
        // restore
        // @ts-ignore
        window.history.pushState = originalPush;
        // @ts-ignore
        window.history.replaceState = originalReplace;
      };
    } catch (e) {
      // ignore in non-browser env
    }
  }, []);

  // Note: location logging moved later where `location` is declared for layout decisions.

  // Centralized refresh handler for admin: refetch main collections without full page reload
  const handleRefresh = async () => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) return;
    try {
    const [remoteDestinations, remoteBlog] = await Promise.all([fetchDestinations(), fetchBlogPosts()]);
      if (Array.isArray(remoteDestinations)) setDestinations(remoteDestinations as unknown as Destination[]);
      if (Array.isArray(remoteBlog)) setBlogPosts(remoteBlog as unknown as BlogPost[]);
  setSupabaseFetchStatus(prev => ({ ...prev, destinations: `refreshed`, blog: `refreshed` }));
    } catch (err) {
      console.warn('[SUPABASE] refresh failed', err);
    }
  };

  // ThemeProvider applies runtime theme body class and persistence.

  // Apply accent color whenever it changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', appSettings.accentColor);
    root.style.setProperty('--accent-hover', shadeColor(appSettings.accentColor, -15));
  }, [appSettings.accentColor]);

  // Update favicons when they change
  useEffect(() => {
    const setFavicon = (id: string, url: string) => {
        const link = document.getElementById(id) as HTMLLinkElement | null;
        if (link && url) {
            link.href = url;
        }
    };
    setFavicon('favicon-16', appSettings.favicon16Url);
    setFavicon('favicon-192', appSettings.favicon192Url);
    setFavicon('favicon-512', appSettings.favicon512Url);
    setFavicon('favicon-apple', appSettings.favicon512Url);
  }, [appSettings.favicon16Url, appSettings.favicon192Url, appSettings.favicon512Url]);

  // Set document title from appSettings to keep page title consistent and editable via admin
  useEffect(() => {
    try {
      const brand = appSettings.brandName || '';
      const tagline = appSettings.tagline || '';
      const title = brand ? (tagline ? `${brand} - ${tagline}` : brand) : (tagline || '');
      if (title) document.title = title;
    } catch (e) {
      // ignore
    }
  }, [appSettings.brandName, appSettings.tagline]);
  
  // Scroll to top on page change (also sync legacy page state when route changes)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Note: legacy `page` state is kept for compatibility, but we intentionally do not auto-sync it
  // back to routes here. Navigation should be performed explicitly via `navigate(...)` where
  // appropriate (most handlers already call navigate). Auto-syncing caused unexpected
  // redirects on direct URL loads, so it was removed.

  const handleLogin = async () => {
  // Mark authenticated and navigate to admin.
  // Actual data refresh is triggered deterministically by the auth-state listener
  // (on SIGNED_IN) so we avoid race conditions and polling heuristics.
  setIsAuthenticated(true);
  try { navigate('/admin'); } catch (e) {}
  };
  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      try { await supabase.auth.signOut(); } catch (e) { console.warn('supabase signOut failed', e); }
    } catch (e) {
      // ignore
    }
    setIsAuthenticated(false);
    try { navigate('/admin'); } catch (e) {}
  };

  const handleSearch = (query: string) => {
  setSearchQuery(query);
  setPage('search');
  try { navigate('/search'); } catch (e) { /* no-op */ }
  };
  
  const handleViewDetail = (destination: Destination) => {
    setSelectedDestination(destination);
    setPage('destinationDetail');
    try {
  // navigation debug removed
      navigate(`/destinations/${destination.slug || destination.id}`);
    } catch (e) {
  // navigation debug removed
    }
  };

  const handleBookNow = (destination: Destination) => {
  // Open destination detail for booking (order flow removed)
  setSelectedDestination(destination);
  try { navigate(`/destinations/${destination.slug || destination.id}`); } catch (e) {}
  };
  
  const handleViewBlogDetail = (post: BlogPost) => {
    setSelectedPost(post);
    setPage('blogDetail');
    try {
  // navigation debug removed
      navigate(`/blog/${post.slug || post.id}`);
    } catch (e) {
  // navigation debug removed
    }
  };
  
  // CRUD Handlers for Destinations
  const handleSaveDestination = async (dest: Destination) => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      if (dest.id === 0) {
        const newDest = { ...dest, id: Date.now() };
        setDestinations(prev => [...prev, newDest]);
        return newDest;
      } else {
        setDestinations(prev => prev.map(d => d.id === dest.id ? dest : d));
        return dest;
      }
    }

    try {
      const saved = await upsertDestination(dest);
      if (saved) {
        // upsert returns the saved row; replace or add
        setDestinations(prev => {
          const exists = prev.some(d => d.id === saved.id);
          if (exists) return prev.map(d => d.id === saved.id ? (saved as Destination) : d);
          return [...prev, (saved as Destination)];
        });
        return saved;
      }
    } catch (err) {
      console.error('Failed to save destination to Supabase, falling back to local state', err);
      // Keep a local fallback so UI remains responsive, but propagate the error to caller
      if (dest.id === 0) {
        const newDest = { ...dest, id: Date.now() };
        setDestinations(prev => [...prev, newDest]);
      } else {
        setDestinations(prev => prev.map(d => d.id === dest.id ? dest : d));
      }
      // Rethrow so caller (UI) can show a toast and allow retry
      throw err;
    }
  };

  const handleDeleteDestination = async (id: number) => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      setDestinations(prev => prev.filter(d => d.id !== id));
      return;
    }
    try {
  // Wait for server ack before removing from local state
  await sbDeleteDestination(id);
  setDestinations(prev => prev.filter(d => d.id !== id));
    } catch (err) {
  console.error('Failed to delete destination from Supabase', err);
  // Rethrow so caller (UI) can handle error and keep modal open
  throw err;
    }
  };

  // CRUD Handlers for Blog Posts
  const handleSaveBlogPost = async (post: BlogPost) => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      if (post.id === 0) {
        const newPost = { ...post, id: Date.now(), date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) };
        setBlogPosts(prev => [...prev, newPost]);
      } else {
        setBlogPosts(prev => prev.map(p => p.id === post.id ? post : p));
      }
      return;
    }
    try {
      const saved = await upsertBlogPost(post);
      if (saved) {
        setBlogPosts(prev => {
          const exists = prev.some(p => p.id === saved.id);
          if (exists) return prev.map(p => p.id === saved.id ? (saved as BlogPost) : p);
          return [...prev, (saved as BlogPost)];
        });
      }
    } catch (err) {
      console.error('Failed to save blog post to Supabase, falling back to local state', err);
      if (post.id === 0) {
        const newPost = { ...post, id: Date.now(), date: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) };
        setBlogPosts(prev => [...prev, newPost]);
      } else {
        setBlogPosts(prev => prev.map(p => p.id === post.id ? post : p));
      }
      // Rethrow so callers (UI) can detect failure and keep the form open for retry
      throw err;
    }
  };

  const handleDeleteBlogPost = async (id: number) => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      setBlogPosts(prev => prev.filter(p => p.id !== id));
      return;
    }
    try {
  // Wait for server ack before removing from local state
  await sbDeleteBlogPost(id);
  setBlogPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
  console.error('Failed to delete blog post from Supabase', err);
  // Rethrow so caller can display error and avoid removing local state
  throw err;
    }
  };

  // CRUD Handlers for Laptops
  const handleSaveLaptop = async (laptop: any) => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      if (laptop.id === 0) {
        const newLaptop = { ...laptop, id: Date.now() };
        setLaptops(prev => [...prev, newLaptop]);
        return newLaptop;
      } else {
        setLaptops(prev => prev.map(l => l.id === laptop.id ? laptop : l));
        return laptop;
      }
    }

    try {
      // try to use upsertLaptops from lib if available
      const mod = await import('./lib/supabase');
      if (mod && (mod as any).upsertLaptop) {
        const saved = await (mod as any).upsertLaptop(laptop);
        if (saved) {
          setLaptops(prev => {
            const exists = prev.some(d => d.id === saved.id);
            if (exists) return prev.map(d => d.id === saved.id ? saved : d);
            return [...prev, saved];
          });
          return saved;
        }
      }
    } catch (err) {
      console.error('Failed to save laptop to Supabase, falling back to local state', err);
      if (laptop.id === 0) {
        const newLaptop = { ...laptop, id: Date.now() };
        setLaptops(prev => [...prev, newLaptop]);
      } else {
        setLaptops(prev => prev.map(d => d.id === laptop.id ? laptop : d));
      }
      throw err;
    }
  };

  const handleDeleteLaptop = async (id: number) => {
    const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!useSupabase) {
      setLaptops(prev => prev.filter(d => d.id !== id));
      return;
    }
    try {
      const mod = await import('./lib/supabase');
      if (mod && (mod as any).deleteLaptop) {
        await (mod as any).deleteLaptop(id);
      }
      setLaptops(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete laptop from Supabase', err);
      throw err;
    }
  };


  // Order-related handlers and public order page removed

  const handleSaveSettings = (newSettings: AppSettings) => {
      setAppSettings(newSettings);
      try { localStorage.setItem('appSettings', JSON.stringify(newSettings)); } catch {}

      const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!useSupabase) return;

      (async () => {
        try {
          const saved = await upsertAppSettings(newSettings);
          if (saved) {
            setAppSettings(prev => ({ ...prev, ...saved }));
            try { localStorage.setItem('appSettings', JSON.stringify(saved)); } catch {}
            try { const { showToast } = (window as any).__REACT_TOAST_CTX__ || {}; } catch {}
            // Show toast via DOM-consumed provider: use a small trick to access ctx in this module
            try { (window as any).__REACT_TOAST_SHOW__ && (window as any).__REACT_TOAST_SHOW__('Pengaturan berhasil disimpan', 'success'); } catch {}
          }
    // debug log removed in production build
        } catch (err) {
          console.warn('[SUPABASE] failed to save app settings', err);
        }
      })();
  };


  // Route wrappers for direct URL access to details
  const DestinationDetailWrapper: React.FC = () => {
    const params = useParams();
    const slug = params.slug || '';
    const id = Number(slug.split('-')[0]);
    const dest = destinations.find(d => d.id === id || d.slug === slug) || null;
    useEffect(() => { if (dest) try { setPage && setPage('destinationDetail'); } catch {} }, [dest]);
  if (dest) {
    return <DestinationDetailPage destination={dest} setPage={setPage} onBookNow={handleBookNow} />;
  }

  // If destination not found, show an empty-state with CTA similar to wishlist
  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <h1>Destinasi tidak ditemukan</h1>
          <p>Maaf, kami tidak menemukan destinasi dengan alamat yang Anda buka.</p>
        </div>
        <div className="wishlist-empty-state">
          <h2>Cari destinasi lain</h2>
          <p>Coba jelajahi halaman Destinasi untuk menemukan paket wisata lainnya.</p>
          <button className="btn btn-primary" onClick={() => { try { setPage && setPage('destinations'); } catch {} ; try { (window as any).location && (window as any).location.assign && (window as any).location.assign('/destinations'); } catch {} }}>Jelajahi Destinasi</button>
        </div>
      </div>
    </div>
  );
  };

  const BlogDetailWrapper: React.FC = () => {
    const params = useParams();
    const slug = params.slug || '';
    const id = Number(slug.split('-')[0]);
    const post = blogPosts.find(p => p.id === id || p.slug === slug) || null;
    useEffect(() => { if (post) try { setPage && setPage('blogDetail'); } catch {} }, [post]);
    return post ? <BlogDetailPage post={post} setPage={setPage} /> : <div className="page-container container"><h1>Artikel tidak ditemukan</h1></div>;
  };

  const LaptopDetailWrapper: React.FC = () => {
    const params = useParams();
    const slug = params.slug || '';
    const id = Number(slug.split('-')[0]);
    const laptop = laptops.find((l: any) => l.id === id || l.slug === slug) || null;
    useEffect(() => { if (laptop) try { setPage && setPage('destinationDetail'); } catch {} }, [laptop]);
    if (laptop) return <LaptopDetailPage laptop={laptop} setPage={setPage} onBuyNow={(l:any) => { /* placeholder */ }} />;
    return (
      <div className="page-container">
        <div className="container">
          <div className="page-header">
            <h1>Laptop tidak ditemukan</h1>
            <p>Maaf, kami tidak menemukan laptop dengan alamat yang Anda buka.</p>
          </div>
        </div>
      </div>
    );
  };

  // New routing using react-router while keeping legacy `setPage` for compatibility
  const renderRoutes = () => (
    <Routes>
  <Route path="/" element={<HomePage onSearch={handleSearch} onViewDetail={handleViewDetail} onBookNow={handleBookNow} onViewBlogDetail={handleViewBlogDetail} setPage={setPage} destinations={destinations} laptops={laptops} blogPosts={blogPosts} appSettings={appSettings} isLoading={homeIsLoading} reviews={reviews} />} />
  <Route path="/destinations" element={<DestinationsPage allDestinations={destinations} onViewDetail={handleViewDetail} onBookNow={handleBookNow} isLoading={homeIsLoading} />} />
  <Route path="/destinations/:slug" element={<DestinationDetailWrapper />} />
  {/* Order page removed */}
  <Route path="/blog" element={<BlogPage blogPosts={blogPosts} onViewDetail={handleViewBlogDetail} isLoading={homeIsLoading} brandName={appSettings.brandName} />} />
  <Route path="/blog/:slug" element={<BlogDetailWrapper />} />
  <Route path="/laptops/:slug" element={<LaptopDetailWrapper />} />
  <Route path="/laptops" element={<LaptopsPage allLaptops={laptops} onViewDetail={(l) => { try { setPage && setPage('destinationDetail'); } catch {} ; try { navigate(`/laptops/${l.slug || l.id}`); } catch {} }} onBuyNow={(l) => { /* placeholder */ }} isLoading={homeIsLoading} />} />
      <Route path="/search" element={<SearchResultsPage query={searchQuery} setPage={setPage} allLaptops={laptops} />} />
  <Route path="/wishlist" element={<WishlistPage setPage={setPage} onViewDetail={handleViewDetail} onBuy={(l:any) => { /* placeholder */ }} allLaptops={laptops} />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
  <Route path="/admin/*" element={isAuthenticated ? (
        <Suspense fallback={<Loading message="Memuat dashboard admin..." size="large" />}>
          <AdminLayout 
            setPage={setPage}
            onLogout={handleLogout}
            onRefresh={handleRefresh}
            destinations={destinations}
            blogPosts={blogPosts}
            laptops={laptops}
            onSaveDestination={handleSaveDestination}
            onDeleteDestination={handleDeleteDestination}
            onSaveBlogPost={handleSaveBlogPost}
            onDeleteBlogPost={handleDeleteBlogPost}
            onSaveLaptop={handleSaveLaptop}
            onDeleteLaptop={handleDeleteLaptop}
            appSettings={appSettings}
            setAppSettings={setAppSettings}
            onSaveSettings={handleSaveSettings}
          />
        </Suspense>
      ) : <AdminLoginPage onLogin={handleLogin} /> } />
  {/* Public invoice routes removed */}
      <Route path="*" element={<HomePage onSearch={handleSearch} onViewDetail={handleViewDetail} onBookNow={handleBookNow} onViewBlogDetail={handleViewBlogDetail} setPage={setPage} destinations={destinations} laptops={laptops} blogPosts={blogPosts} appSettings={appSettings} />} />
    </Routes>
  );
  
  const currentLocation = useLocation();
  // Hide header/footer for admin routes
  const showHeaderFooter = !currentLocation.pathname.startsWith('/admin');

  return (
    <ToastProvider>
      <WishlistProvider>
      <ThemeProvider>
    {showHeaderFooter && <Header setPage={setPage} appSettings={appSettings} setAppSettings={setAppSettings} isAuthenticated={isAuthenticated} />}
      <main>
        {renderRoutes()}
      </main>
      {showHeaderFooter && <Footer setPage={setPage} appSettings={appSettings} />}
  {showHeaderFooter && appSettings.whatsappNumber && (
      (currentLocation.pathname === '/' || currentLocation.pathname.startsWith('/search') || currentLocation.pathname === '/destinations') && (
      <StickyWhatsAppButton
        whatsappNumber={appSettings.whatsappNumber}
      />)
    )}
  {/* Booking modal is now managed locally inside DestinationDetailPage to avoid top-level re-renders */}
  </ThemeProvider>
    </WishlistProvider>
    </ToastProvider>
  );
};

export default App;