import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Romota FB Editor",
    description: "Advanced social media post editor",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
