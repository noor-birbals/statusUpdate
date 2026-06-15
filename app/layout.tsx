import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sprint Command Centre',
  description: 'Live sprint dashboard for Micurato and Birbals Jira boards',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
