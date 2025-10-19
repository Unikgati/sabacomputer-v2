import React, { useEffect, useState } from 'react';
import { BlogDetailSkeleton } from '../components/DetailSkeletons';
import { BlogPost, Page } from '../types';
import Seo from '../components/Seo';

interface BlogDetailPageProps {
    post: BlogPost;
    setPage: (page: Page) => void;
    brandName?: string;
}

export const BlogDetailPage: React.FC<BlogDetailPageProps> = ({ post, setPage, brandName }) => {
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        window.scrollTo(0, 0);
        const t = setTimeout(() => setIsLoading(false), 300);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        try {
            document.title = brandName ? `${post.title} - ${brandName}` : post.title;
        } catch (e) {}
        return () => {
            // optionally reset title when leaving; App has its own effect to set brand-based title
        };
    }, [post.title, brandName]);

    if (isLoading) return <BlogDetailSkeleton />;

    return (
        <div className="page-container blog-detail-page">
            <Seo
                title={`${post.title} - ${brandName || 'TravelGo'}`}
                description={(post.excerpt || post.title || '').slice(0, 160)}
                url={window.location.href}
                image={post.imageUrl}
                siteName={brandName || 'TravelGo'}
            />
            <header className="blog-detail-header" style={{ backgroundImage: `url(${post.imageUrl})` }}>
                <div className="hero-overlay"></div>
            </header>
            <div className="container">
                <div className="blog-detail-layout">
                    <div className="blog-detail-title-container">
                        <h1>{post.title}</h1>
                    </div>

                    <div className="blog-detail-meta">
                        <span className="blog-card-category">{post.category}</span>
                        <span>Oleh: <strong>{post.author}</strong></span>
                        <span>{post.date}</span>
                    </div>

                    <main 
                        className="blog-detail-content"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />
                </div>
            </div>
        </div>
    );
};