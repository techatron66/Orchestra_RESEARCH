import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orchestra Research',
  description: 'Multi-agent AI research authoring with RAG verification',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
