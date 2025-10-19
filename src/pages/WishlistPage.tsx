import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page } from '../types';
import { useWishlist } from '../contexts/WishlistContext';
import { LaptopCard } from '../components/LaptopCard';
import { ArrowLeftIcon } from '../components/Icons';
interface WishlistPageProps {
    setPage: (page: Page) => void;
    onViewDetail: (d: any) => void;
    onBuy?: (l: any) => void;
    allLaptops: any[];
}

export const WishlistPage: React.FC<WishlistPageProps> = ({ setPage, onViewDetail, onBuy, allLaptops = [] }) => {
    const { wishlist } = useWishlist();
    const wishlistedLaptops = allLaptops.filter(l => wishlist.includes(l.id));
    const navigate = useNavigate();
    return (
        <div className="page-container">
            <div className="container">
                <div className="page-header">
                    <h1>Wishlist Saya</h1>
                    <p>Produk laptop yang telah Anda simpan untuk dilihat nanti.</p>
                </div>
                {wishlistedLaptops.length > 0 ? (
                    <div className="destinations-grid homepage-grid wishlist-grid">
                        {wishlistedLaptops.map(l => (
                            <LaptopCard key={l.id} laptop={l} onViewDetail={(lp: any) => { try { setPage && setPage('laptopDetail'); } catch {} ; try { navigate(`/laptops/${lp.slug || lp.id}`); } catch {} }} showCategories={false} />
                        ))}
                    </div>
                ) : (
                    <div className="wishlist-empty-state">
                        <h2>Wishlist Anda kosong</h2>
                        <p>Mulai jelajahi produk laptop dan tambahkan ke wishlist.</p>
                        <button className="btn btn-primary" onClick={() => { navigate('/laptops'); try { setPage && setPage('laptops'); } catch {} }}>Jelajahi Produk</button>
                    </div>
                )}
            </div>
        </div>
    );
};