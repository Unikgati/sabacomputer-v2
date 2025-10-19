import React, { useState, useMemo, useEffect } from 'react';
import { useToast } from '../../components/Toast';
import LaptopForm from '../../components/admin/LaptopForm.tsx';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { EditIcon, TrashIcon } from '../../components/Icons';
import { AdminRowSkeleton } from '../../components/DetailSkeletons';

interface Laptop {
    id: number;
    name: string;
    price?: number;
    categories?: string[];
    imageUrl?: string;
    galleryImages?: string[];
    // specs
    ram?: string;
    storage?: string;
    cpu?: string;
    displayInch?: number;
    condition?: 'new' | 'second';
    features?: string[];
}

interface AdminLaptopsPageProps {
    laptops: Laptop[];
    onSave: (laptop: any) => void;
    onDelete: (id: number) => void;
}

export const AdminLaptopsPage: React.FC<AdminLaptopsPageProps> = ({ laptops = [], onSave, onDelete }) => {
    const { showToast } = useToast();
    const [editingLaptop, setEditingLaptop] = useState<any | null>(null);
    const [laptopToDelete, setLaptopToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [adminLaptops, setAdminLaptops] = useState<Laptop[] | null>(null);

    useEffect(() => { const t = setTimeout(() => setIsLoading(false), 300); return () => clearTimeout(t); }, []);

    // When admin page mounts, fetch an admin-visible list (includes out-of-stock).
    // We keep this list separate from the parent-provided `laptops` to avoid
    // ownership conflicts. If the fetch fails we fall back to props.
    useEffect(() => {
        const useSupabase = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
        let mounted = true;
        if (!useSupabase) { setIsLoading(false); return; }
        (async () => {
            try {
                const mod = await import('../../lib/supabase');
                const all = (mod as any).fetchLaptops ? await (mod as any).fetchLaptops({ includeOutOfStock: true }) : [];
                if (!mounted) return;
                setAdminLaptops(all || []);
            } catch (e) {
                // ignore and fall back to props
            } finally {
                if (mounted) setIsLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const allCategories = useMemo(() => {
        const set = new Set<string>();
        laptops.forEach(l => { (l.categories || []).forEach(c => set.add(c)); });
        return Array.from(set).sort();
    }, [laptops]);

    const handleAddNew = () => {
        const template = { id: 0, name: '', price: 0, categories: [], imageUrl: '', galleryImages: [], description: '', inclusions: [] };
        setEditingLaptop(template); setIsFormVisible(true);
    };
    const handleEdit = (l: any) => { setEditingLaptop(l); setIsFormVisible(true); };

    const handleSave = async (laptop: any) => {
        try {
            await onSave(laptop);
            try { showToast('Laptop berhasil disimpan', 'success'); } catch {}
            // Update local admin list if we have it
            if (adminLaptops) {
                setAdminLaptops(prev => {
                    const list = prev ? [...prev] : [];
                    const idx = list.findIndex(l => l.id === laptop.id);
                    if (idx >= 0) { list[idx] = { ...list[idx], ...laptop }; }
                    else { list.unshift(laptop); }
                    return list;
                });
            }
            setIsFormVisible(false);
            setEditingLaptop(null);
        } catch (err) {
            console.error('Save laptop failed', err);
            try { showToast('Gagal menyimpan laptop', 'error'); } catch {}
        }
    };
    

    const handleDeleteRequest = (l: any) => setLaptopToDelete(l);
    const handleConfirmDelete = async () => {
        if (!laptopToDelete) return; setIsDeleting(true);
        try { await Promise.resolve(onDelete(laptopToDelete.id)); try { showToast('Laptop berhasil dihapus', 'success'); } catch {} setLaptopToDelete(null); } catch (err) { console.error('Delete laptop failed', err); try { showToast('Gagal menghapus laptop', 'error'); } catch {} } finally { setIsDeleting(false); }
    };

    // If we have an admin-managed list, remove deleted item from it after delete
    useEffect(() => {
        if (!adminLaptops) return;
        if (!laptopToDelete) return;
        const id = laptopToDelete.id;
        setAdminLaptops(prev => (prev || []).filter(p => p.id !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [laptopToDelete]);

    const formatPrice = (p?: number) => p ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(p) : '-';

    if (isFormVisible && editingLaptop) {
        return <LaptopForm laptop={editingLaptop} onSave={handleSave} onCancel={() => { setIsFormVisible(false); setEditingLaptop(null); }} allCategories={allCategories} />
    }

    return (
        <div>
            <div className="admin-page-actions">
                {(!isLoading && laptops.length > 0) && (<button className="btn btn-primary" onClick={handleAddNew}>Tambah Laptop</button>)}
            </div>
            <div className="admin-grid">
                {isLoading && Array.from({ length: 6 }).map((_, i) => (<AdminRowSkeleton key={i} />))}
                {!isLoading && ( (adminLaptops && adminLaptops.length === 0) || (!adminLaptops && laptops.length === 0) ) && (
                    <div className="admin-empty-state">
                        <h3>Belum ada laptop</h3>
                        <p>Tambahkan laptop baru untuk mulai menambahkan katalog.</p>
                        <div style={{ marginTop: '1rem' }}><button className="btn btn-primary" onClick={handleAddNew}>Tambah Laptop</button></div>
                    </div>
                )}
                {!isLoading && ((adminLaptops && adminLaptops.length > 0) || (!adminLaptops && laptops.length > 0)) && (
                    (adminLaptops || laptops).map(l => (
                        <div key={l.id} className="admin-item-card">
                            {/* Out-of-stock badge for admin visibility */}
                            {((l as any).inStock === false || (l as any).in_stock === false) && (
                                <div className="admin-item-badge out-of-stock">Tidak tersedia</div>
                            )}
                            <img src={l.imageUrl} alt={l.name} className="admin-item-image" loading="lazy" decoding="async" />
                            <div className="admin-item-info">
                                <h3>{l.name}</h3>
                                <p>{formatPrice(l.price)}</p>
                            </div>
                            <div className="admin-item-actions">
                                <button className="btn-icon" onClick={() => handleEdit(l)} aria-label={`Edit ${l.name}`}><EditIcon /></button>
                                <button className="btn-icon delete" onClick={() => handleDeleteRequest(l)} aria-label={`Hapus ${l.name}`}><TrashIcon /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {laptopToDelete && (
                <ConfirmationModal isOpen={!!laptopToDelete} onClose={() => setLaptopToDelete(null)} onConfirm={handleConfirmDelete} title="Konfirmasi Penghapusan" confirmButtonText="Hapus" confirmButtonVariant="danger" isLoading={isDeleting}>
                    <p>Apakah Anda yakin ingin menghapus laptop <strong>{laptopToDelete.name}</strong>? Tindakan ini tidak dapat dibatalkan.</p>
                </ConfirmationModal>
            )}
        </div>
    );
};

export default AdminLaptopsPage;
