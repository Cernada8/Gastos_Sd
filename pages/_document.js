import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        {/* Google Fonts — Inter */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Tailwind CSS CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
        {/* Chart.js CDN */}
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
        {/* Tailwind config inline */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              tailwind.config = {
                theme: {
                  extend: {
                    fontFamily: { sans: ['Inter', 'sans-serif'] },
                    colors: {
                      surface: '#111111',
                      card:    '#1A1A1A',
                      border:  '#2A2A2A',
                      accent:  '#D42B2B',
                      'accent-hover': '#B52222',
                    }
                  }
                }
              }
            `,
          }}
        />
        <meta name="theme-color" content="#111111" />
        {/* Favicon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
      </Head>
      <body className="bg-surface text-white font-sans antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
