import './globals.css';

export const metadata = {
  title: 'MailerFlex',
  description: 'Modern Bulk Email Marketing Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 flex h-screen overflow-hidden font-sans">
        {children}
      </body>
    </html>
  );
}