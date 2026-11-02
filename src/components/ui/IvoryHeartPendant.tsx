import React, { useId } from 'react';
import { motion } from 'motion/react';

interface IvoryHeartPendantProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const IvoryHeartPendant: React.FC<IvoryHeartPendantProps> = ({
  className = '',
  size = 'md',
  interactive = false,
}) => {
  const rawId = useId();
  // Safe ID without colons for SVG references
  const uniqueId = `ivory_${rawId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const sizeClasses = {
    sm: 'w-8 h-8 md:w-9 md:h-9',
    md: 'w-14 h-14 md:w-16 md:h-16',
    lg: 'w-24 h-24 md:w-28 md:h-28',
  };

  return (
    <motion.div
      className={`relative inline-block select-none pointer-events-none ${sizeClasses[size]} ${className}`}
      style={{ transformOrigin: 'top center' }}
      animate={{
        rotate: [0, 3, -3, 2, -2, 1, -1, 0],
      }}
      transition={{
        duration: 7,
        ease: 'easeInOut',
        repeat: Infinity,
        repeatType: 'mirror',
      }}
      whileHover={
        interactive
          ? {
              rotate: [0, 10, -8, 5, -3, 0],
              transition: { duration: 1.5, ease: 'easeOut' },
            }
          : undefined
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 500 500"
        className="w-full h-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
      >
        <defs>
          {/* Braided Dark Cord */}
          <linearGradient id={`${uniqueId}_cord`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3a322b" />
            <stop offset="50%" stopColor="#1f1a17" />
            <stop offset="100%" stopColor="#120f0d" />
          </linearGradient>

          {/* Genuine Ivory / Cream Body Gradient */}
          <radialGradient id={`${uniqueId}_body`} cx="42%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#FAF7EE" />
            <stop offset="55%" stopColor="#F3EBD8" />
            <stop offset="85%" stopColor="#E4D7BE" />
            <stop offset="100%" stopColor="#D5C5A5" />
          </radialGradient>

          {/* Warm Specular Ivory Luster */}
          <radialGradient id={`${uniqueId}_glow`} cx="38%" cy="28%" r="42%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#FFFDF7" stopOpacity="0.5" />
            <stop offset="80%" stopColor="#FAF4E5" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#F0E5CC" stopOpacity="0" />
          </radialGradient>

          {/* Soft Depth Edge Tint */}
          <radialGradient id={`${uniqueId}_edge`} cx="65%" cy="70%" r="50%">
            <stop offset="0%" stopColor="#D5C5A5" stopOpacity="0" />
            <stop offset="70%" stopColor="#C9B690" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#BBA47A" stopOpacity="0.65" />
          </radialGradient>
        </defs>

        {/* Left Cord Branch */}
        <path
          d="M 100,-10 C 130,50 195,85 228,105"
          stroke={`url(#${uniqueId}_cord)`}
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 100,-10 C 130,50 195,85 228,105"
          stroke="#4a3e35"
          strokeWidth="26"
          strokeDasharray="5 7"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />

        {/* Right Cord Branch */}
        <path
          d="M 400,-10 C 370,50 305,85 272,105"
          stroke={`url(#${uniqueId}_cord)`}
          strokeWidth="26"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 400,-10 C 370,50 305,85 272,105"
          stroke="#4a3e35"
          strokeWidth="26"
          strokeDasharray="5 7"
          strokeLinecap="round"
          fill="none"
          opacity="0.5"
        />

        {/* Ivory Loop / Bail */}
        <path
          d="M 234,120 C 234,80 266,80 266,120 L 268,144 C 268,150 232,150 232,144 Z"
          fill={`url(#${uniqueId}_body)`}
          stroke="#C8B896"
          strokeWidth="2"
        />

        {/* Base Solid Fallback in case SVG gradients take time or encounter engine issues */}
        <path
          d="M 250,158 C 215,110 100,110 75,200 C 50,290 150,380 235,438 C 245,445 255,445 265,438 C 350,380 450,290 425,200 C 400,110 285,110 250,158 Z"
          fill="#FAF6ED"
        />

        {/* Main Ivory Heart Body */}
        <path
          d="M 250,158 C 215,110 100,110 75,200 C 50,290 150,380 235,438 C 245,445 255,445 265,438 C 350,380 450,290 425,200 C 400,110 285,110 250,158 Z"
          fill={`url(#${uniqueId}_body)`}
          stroke="#C8B896"
          strokeWidth="2.5"
        />

        {/* Soft Depth Edge Shading */}
        <path
          d="M 250,158 C 215,110 100,110 75,200 C 50,290 150,380 235,438 C 245,445 255,445 265,438 C 350,380 450,290 425,200 C 400,110 285,110 250,158 Z"
          fill={`url(#${uniqueId}_edge)`}
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Specular Glow Overlay */}
        <path
          d="M 250,158 C 215,110 100,110 75,200 C 50,290 150,380 235,438 C 245,445 255,445 265,438 C 350,380 450,290 425,200 C 400,110 285,110 250,158 Z"
          fill={`url(#${uniqueId}_glow)`}
        />

        {/* Organic Light Curved Reflection Streak */}
        <path
          d="M 135,195 C 115,225 120,265 145,300"
          stroke="#FFFFFF"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          opacity="0.65"
        />
        <path
          d="M 135,195 C 115,225 120,265 145,300"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
      </svg>
    </motion.div>
  );
};
