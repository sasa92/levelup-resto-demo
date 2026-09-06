import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// La police premium pour nos grands titres style magazine
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata = {
  title: "Brambino | Trattoria & Cocktail Bar",
  description: "Restaurant italien moderne - Expérience culinaire immersive par LEVELUP Studio.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full bg-[#0a0a0a] text-stone-100 font-sans flex flex-col">
        {children}
      </body>
    </html>
  );
}