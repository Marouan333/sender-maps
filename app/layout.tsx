import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sender Maps',
  description: 'WhatsApp outreach for businesses without websites',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
          <a href="/" className="font-bold text-lg tracking-tight">Sender Maps</a>
          <a
            href="/new"
            className="bg-white text-green-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-green-50 transition"
          >
            + New campaign
          </a>
        </nav>
        <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
