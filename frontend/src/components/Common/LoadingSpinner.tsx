import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'medium', 
  color = '#2563eb' 
}) => {
  const sizeClass = {
    small: '16px',
    medium: '24px',
    large: '32px'
  }[size];

  return (
    <div 
      className="loading-spinner"
      style={{
        width: sizeClass,
        height: sizeClass,
        border: `2px solid #f3f4f6`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}
    />
  );
};

export default LoadingSpinner;
