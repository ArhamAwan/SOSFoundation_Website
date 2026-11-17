export const metadata = { title: 'SOS Foundation', robots: { index: false, follow: false }, icons: { icon: '/assets/img/sosf-mark.webp' } };

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
