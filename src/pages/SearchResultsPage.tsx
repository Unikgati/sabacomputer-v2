import React from 'react';
import { Page } from '../types';
import { LaptopCard } from '../components/LaptopCard';
import { useNavigate } from 'react-router-dom';

interface SearchResultsPageProps {
    query: string;
    setPage: (page: Page) => void;
    allLaptops: any[];
}

export const SearchResultsPage: React.FC<SearchResultsPageProps> = ({ query, setPage, allLaptops = [] }) => {
    const navigate = useNavigate();
    const q = (query || '').toLowerCase();
    const results = allLaptops.filter(l => {
        const name = (l.name || '').toLowerCase();
        const desc = (l.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
    });

    return (
        <div className="page-container">
            <div className="container">
                <div className="page-header">
                    <h1>Hasil Pencarian untuk: "{query}"</h1>
                    <p>Ditemukan {results.length} produk yang cocok.</p>
                </div>
                {results.length > 0 ? (
                    <div className="destinations-grid homepage-grid">
                        {results.map(l => (
                            <LaptopCard key={l.id} laptop={l} onViewDetail={(lp: any) => { try { setPage && setPage('laptopDetail'); } catch {} ; try { navigate(`/laptops/${lp.slug || lp.id}`); } catch {} }} showCategories={false} />
                        ))}
                    </div>
                ) : (
                    <div className="wishlist-empty-state">
                        <h2>Tidak ada hasil pencarian</h2>
                        <p>Maaf, tidak ada produk yang cocok dengan kata kunci Anda.</p>
                        <p>Coba gunakan kata kunci lain atau jelajahi semua produk.</p>
                        <button className="btn btn-primary" onClick={() => { try { setPage && setPage('laptops'); } catch {} ; try { (window as any).location && (window as any).location.assign && (window as any).location.assign('/laptops'); } catch {} }}>Jelajahi Produk</button>
                    </div>
                )}
            </div>
        </div>
    );
};