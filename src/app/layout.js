import './globals.css';
import Header from './components/header';
import Footer from './components/footer';
import { RouteLoader } from './components/RouteLoader';
import SessionWrapper from './components/SessionWrapper';
import { Toaster } from 'react-hot-toast';
export const metadata = {
  title: 'Oasis – Agrotourism & Wellness',
  description: 'Rooted, soulful, slow travel in Crete.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Add Cloudinary script here */}
        <script
          src="https://upload-widget.cloudinary.com/global/all.js"
          type="text/javascript"
        ></script>
      </head>
      <body className="flex min-h-screen flex-col pt-[72px] bg-[#f4f1ec] text-[#2f2f2f] antialiased">
        <SessionWrapper>
          <RouteLoader>
            <Header />
            <Toaster position="top-right" />
            <main className="flex-1">{children}</main>
            <Footer />
          </RouteLoader>
        </SessionWrapper>
      </body>
    </html>
  );
}
