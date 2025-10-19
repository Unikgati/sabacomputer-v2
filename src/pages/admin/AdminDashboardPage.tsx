import React from 'react';

interface AdminDashboardPageProps {
    laptopCount: number;
    blogPostCount: number;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ laptopCount, blogPostCount }) => {
    return (
        <div>
            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <h3>Total Laptop</h3>
                    <p className="count">{laptopCount}</p>
                </div>
                <div className="dashboard-card">
                    <h3>Total Artikel Blog</h3>
                    <p className="count">{blogPostCount}</p>
                </div>
            </div>
        </div>
    );
};