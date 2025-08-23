import './globals.css';
import { Geist, Geist_Mono } from "next/font/google";
import { ThirdwebProvider } from 'thirdweb/react';
import ParticlesCanvas from './components/ParticleCanvas';

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: 'destack',
  description: 'A platform to get or give help',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased relative min-h-screen overflow-hidden`}>
        <div className="absolute inset-0 -z-50">
          <div className="background-gradient" />
          <div className="background-waves" />
          <ParticlesCanvas />
        </div>

        <ThirdwebProvider>
          <main className="relative z-10">{children}</main>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
