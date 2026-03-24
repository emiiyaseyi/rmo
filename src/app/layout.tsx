import { Inter, Poppins, Plus_Jakarta_Sans, DM_Sans } from "next/font/google";
import { Toaster } from 'react-hot-toast'
import { AppProvider } from '../context/AppContext'
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins"
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta"
});
const dmsans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm"
});

export const metadata = {
  title: "DSN Resource Management System",
  description: "Full-featured timesheet, approval, and staff management system",
  icons: {
    icon: '/dsn.png',
    shortcut: '/dsn.png',
    apple: '/dsn.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable} ${jakarta.variable} ${dmsans.variable}`}>
        <AppProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                fontFamily: 'var(--font-poppins)',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#076C04', secondary: 'white' } },
              error: { iconTheme: { primary: '#D8001A', secondary: 'white' } },
            }}
          />
          {children}
        </AppProvider>
      </body>
    </html>
  );
}

