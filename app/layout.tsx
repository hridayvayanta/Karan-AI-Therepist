import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Karan — Your Everyday AI Companion',
  description: 'A thoughtful, voice-enabled personal companion AI for daily conversation, reflection, and focus.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#09090d] text-[#f4f4f7] min-h-screen antialiased selection:bg-purple-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
