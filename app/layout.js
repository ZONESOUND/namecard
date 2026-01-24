import './globals.css';

export const metadata = {
    title: 'Smart Name Card Manager',
    description: 'AI-Powered Professional Contact Management',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                {/* Fonts are loaded via CSS import in globals.css, but we can double check here if needed later */}
            </head>
            <body>
                <div className="bg-ambient" />
                <main className="min-h-screen relative z-10">
                    {children}
                </main>
            </body>
        </html>
    );
}
