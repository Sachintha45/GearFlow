import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "GearFlow | Automotive Pro Editor",
    description: "Advanced automotive social media post editor",
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
