import React from 'react';
import './Header.css';

interface HeaderProps {
  title: string;
  user?: string;
}

const Header: React.FC<HeaderProps> = ({ title, user }) => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">{title}</h1>
        {user && (
          <div className="header-user">
            <span className="user-icon">👤</span>
            <span className="user-name">{user}</span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
