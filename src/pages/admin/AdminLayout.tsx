import React, { useState } from 'react';
import { Destination, BlogPost, Page, AppSettings } from '../../types';
import { AdminDashboardPage } from './AdminDashboardPage';
import { AdminDestinationsPage } from './AdminDestinationsPage';
import { AdminBlogPage } from './AdminBlogPage';
import AdminLaptopsPage from './AdminLaptopsPage';
// Orders and invoices removed per feature flag. AdminOrdersPage and InvoicePage removed.
import { AdminSettingsPage } from './AdminSettingsPage';
import { SunIcon, MoonIcon, MenuIcon, RefreshIcon } from '../../components/Icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../components/Toast';
import { NavLink, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

type AdminSubPage = 'dashboard' | 'destinations' | 'laptops' | 'blog' | 'settings';

interface AdminLayoutProps {
    setPage: (page: Page) => void;
    onLogout: () => void;
    destinations: Destination[];
    blogPosts: BlogPost[];
    // orders removed
    laptops?: any[];
    onSaveDestination: (destination: Destination) => void;
    onDeleteDestination: (id: number) => void;
    // Laptops (new feature)
    onSaveLaptop?: (laptop: any) => void;
    onDeleteLaptop?: (id: number) => void;
    onSaveBlogPost: (post: BlogPost) => void;
    onDeleteBlogPost: (id: number) => void;
    // order-related handlers removed
    appSettings: AppSettings;
    setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
    onSaveSettings: (settings: AppSettings) => void;
    onRefresh?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ 
    setPage, onLogout, destinations, blogPosts, laptops,
    onSaveDestination, onDeleteDestination, onSaveBlogPost, onDeleteBlogPost,
    onSaveLaptop, onDeleteLaptop,
    appSettings, setAppSettings, onSaveSettings, onRefresh
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const location = useLocation();

    // Defensive: props may be null at runtime (from API fetch); ensure safe defaults
    const safeDestinations = destinations ?? [];
    const safeBlogPosts = blogPosts ?? [];
    const safeLaptops = laptops ?? [];
    // orders removed; show zero counts where needed
    const safeOrders: any[] = [];

    const supabaseConfigured = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    const cloudinaryConfigured = !!import.meta.env.VITE_CLOUDINARY_CLOUD_NAME && !!import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    // Close sidebar automatically on navigation when in mobile / narrow view
    React.useEffect(() => {
        try {
            if (isSidebarOpen && typeof window !== 'undefined' && window.innerWidth <= 768) {
                setIsSidebarOpen(false);
            }
        } catch (e) {
            // ignore
        }
    }, [location.pathname]);

    const logoUrl = theme === 'dark'
        ? appSettings.logoDarkUrl || appSettings.logoLightUrl
        : appSettings.logoLightUrl || appSettings.logoDarkUrl;

    return (
        <>
            {isSidebarOpen && <div className="admin-sidebar-overlay visible" onClick={() => setIsSidebarOpen(false)}></div>}
            <div className="admin-layout">
                <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                    <div className="logo" role="button" tabIndex={0} onClick={() => { try { setPage && setPage('home'); } catch {} ; setIsSidebarOpen(false); navigate('/'); }} onKeyPress={(e) => { if (e.key === 'Enter' || e.key === ' ') { try { setPage && setPage('home'); } catch {} ; setIsSidebarOpen(false); navigate('/'); } }}>
                        {logoUrl ? <img src={logoUrl} alt={`${appSettings.brandName} Logo`} /> : appSettings.brandName}
                    </div>
                    <ul className="admin-nav">
                        <li><NavLink to="/admin" end className={({isActive}) => isActive ? 'active' : ''} onClick={() => setIsSidebarOpen(false)}>Dashboard</NavLink></li>
                        <li><NavLink to="/admin/blog" className={({isActive}) => isActive ? 'active' : ''} onClick={() => setIsSidebarOpen(false)}>Blog</NavLink></li>
                        <li><NavLink to="/admin/laptops" className={({isActive}) => isActive ? 'active' : ''} onClick={() => setIsSidebarOpen(false)}>Laptop</NavLink></li>
                        <li><NavLink to="/admin/settings" className={({isActive}) => isActive ? 'active' : ''} onClick={() => setIsSidebarOpen(false)}>Pengaturan</NavLink></li>
                    </ul>
                    <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                        <button onClick={() => { try { setPage && setPage('home'); } catch {} ; navigate('/'); }}>Kembali ke Situs</button>
                        <button onClick={onLogout}>Logout</button>
                    </div>
                </aside>
                <main className="admin-main">
                    {/* Non-blocking runtime warnings for missing env vars */}
                    {(!supabaseConfigured || !cloudinaryConfigured) && (
                        <div className="admin-env-warning">
                            <strong>Perhatian:</strong> Konfigurasi Supabase/Cloudinary belum lengkap. Cek README untuk setup.
                            <a href="/README.md" target="_blank" rel="noreferrer" style={{ marginLeft: '8px' }}>Lihat README</a>
                        </div>
                    )}
                    <div className="admin-header">
                         <button className="admin-hamburger" onClick={() => setIsSidebarOpen(true)}>
                            <MenuIcon />
                         </button>
                         <div className="admin-header-actions">
                            <button
                                className="btn-icon"
                                aria-label="Muat ulang data"
                                onClick={async () => {
                                    if (isRefreshing) return;
                                    setIsRefreshing(true);
                                    try {
                                        if (typeof onRefresh === 'function') {
                                            // Support promise-returning handlers
                                            const res = onRefresh();
                                            if (res && typeof (res as any).then === 'function') {
                                                await (res as any);
                                            }
                                        } else {
                                            window.location.reload();
                                        }
                                        try { showToast('Data berhasil dimuat ulang', 'success'); } catch {}
                                    } catch (err) {
                                        console.warn('Refresh failed', err);
                                        try { showToast('Gagal memuat ulang data', 'error'); } catch {}
                                    } finally {
                                        setIsRefreshing(false);
                                    }
                                }}
                                disabled={isRefreshing}
                              >
                                {isRefreshing ? <div className="spinner" aria-hidden /> : <RefreshIcon />}
                            </button>
                                                        <button
                                                                className="theme-toggle"
                                                                onClick={toggleTheme}
                                                                aria-label={theme === 'light' ? 'Ganti ke mode gelap' : 'Ganti ke mode terang'}
                                                            >
                                                                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                                                        </button>
                         </div>
                    </div>

                    <Routes>
                        <Route index element={<AdminDashboardPage laptopCount={safeLaptops.length} blogPostCount={safeBlogPosts.length} />} />
                        <Route path="blog" element={<AdminBlogPage blogPosts={safeBlogPosts} onSave={onSaveBlogPost} onDelete={onDeleteBlogPost} />} />
                        <Route path="laptops" element={onSaveLaptop ? <AdminLaptopsPage laptops={safeLaptops} onSave={onSaveLaptop} onDelete={onDeleteLaptop || (() => {})} /> : <div className="admin-page-container">Halaman Laptop belum dikonfigurasi.</div>} />
                        {/* Orders & invoices removed */}
                        {/* Note: public /invoice/:invoiceId route is registered at app-level (App.tsx) */}
                        <Route path="settings" element={<AdminSettingsPage appSettings={appSettings} onSaveSettings={onSaveSettings} />} />
                    </Routes>
                </main>
            </div>
        </>
    );
};