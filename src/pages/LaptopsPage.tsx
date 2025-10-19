import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LaptopCard } from '../components/LaptopCard';
import LaptopSkeleton from '../components/DestinationSkeleton';

interface LaptopsPageProps {
  allLaptops: any[];
  onViewDetail: (l: any) => void;
  onBuyNow?: (l: any) => void;
  isLoading?: boolean;
}

export const LaptopsPage: React.FC<LaptopsPageProps> = ({ allLaptops = [], onViewDetail, onBuyNow, isLoading = false }) => {
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const navigate = useNavigate();

  const categories = useMemo(() => {
    const allCats = allLaptops.flatMap(l => l.categories || []);
    const uniqueCats = ['Semua', ...Array.from(new Set(allCats)).sort()];
    return uniqueCats;
  }, [allLaptops]);

  const filtered = useMemo(() => {
    if (selectedCategory === 'Semua') return allLaptops;
    return allLaptops.filter(l => (l.categories || []).includes(selectedCategory));
  }, [allLaptops, selectedCategory]);

  return (
    <div className="page-container">
      <div className="container">
        <div className="page-header">
          <h1>Semua Laptop</h1>
          <p>Temukan berbagai laptop yang tersedia di katalog kami.</p>
        </div>

        {categories.length > 1 && (
          <div className="category-filter-list">
            {categories.map(cat => (
              <button key={cat} className={`category-filter-pill ${selectedCategory === cat ? 'active' : ''}`} onClick={() => setSelectedCategory(cat)}>{cat}</button>
            ))}
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="destinations-grid homepage-grid">
            {isLoading ? Array.from({ length: 6 }).map((_, i) => <LaptopSkeleton key={i} />) : filtered.map(l => (
              <LaptopCard key={l.id} laptop={l} onViewDetail={onViewDetail} onBuyNow={onBuyNow} showCategories={false} />
            ))}
          </div>
        ) : (
          <div className="no-results"><p>Tidak ada laptop untuk kategori "{selectedCategory}".</p></div>
        )}
      </div>
    </div>
  );
};

export default LaptopsPage;
