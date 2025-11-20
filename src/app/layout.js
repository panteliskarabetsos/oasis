// src/app/layout.js
import "./globals.css";
import { RouteLoader } from "./components/RouteLoader";
import SessionWrapper from "./components/SessionWrapper";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Oasis – Agrotourism & Wellness",
  description: "Rooted, soulful, slow travel in Crete.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script
          src="https://upload-widget.cloudinary.com/global/all.js"
          type="text/javascript"
        ></script>
      </head>
      <body className="flex min-h-screen flex-col bg-[#f4f1ec] text-[#2f2f2f] antialiased">
        <SessionWrapper>
          <RouteLoader>
            {/* Global toaster is fine here, no locale needed */}
            <Toaster position="top-right" />
            {/* All routes (including [locale]) render here */}
            {children}
          </RouteLoader>
        </SessionWrapper>
      </body>
    </html>
  );
}
