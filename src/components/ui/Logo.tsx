interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizes = {
    sm: 24,
    md: 32,
    lg: 56,
};

export default function Logo({ size = 'md', className = '' }: LogoProps) {
    const px = sizes[size];

    return (
        <svg
            width={px}
            height={px}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#6D28D9" />
                </linearGradient>
            </defs>
            {/* Stylized "P" mark with gradient */}
            <path
                d="M16 36V12h8c2.2 0 4.1.8 5.7 2.3C31.2 15.8 32 17.7 32 20s-.8 4.2-2.3 5.7C28.1 27.2 26.2 28 24 28h-4v8h-4zm4-12h4c1.1 0 2-.4 2.8-1.2.8-.8 1.2-1.7 1.2-2.8s-.4-2-1.2-2.8C26 16.4 25.1 16 24 16h-4v8z"
                fill="url(#logo-grad)"
            />
        </svg>
    );
}
