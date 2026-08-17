import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";

const robotoMono = Roboto_Mono({ subsets: ["latin"] });

// Base URL for absolute social-media URLs. Set NEXT_PUBLIC_SITE_URL to the
// deployed origin (e.g. https://meteordash.vercel.app) in production.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://meteordash.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Meteor Dash — Hand-Gesture Space Arcade",
    template: "%s · Meteor Dash",
  },
  description:
    "Steer your rocket through five asteroid-belt zones using nothing but hand gestures. Graze meteors for combos, grab power-ups, and defeat themed guardians in this camera-controlled space arcade.",
  applicationName: "Meteor Dash",
  authors: [{ name: "Ankush Karmakar" }],
  creator: "Ankush Karmakar",
  keywords: [
    "Meteor Dash",
    "hand gesture game",
    "space arcade",
    "AI game",
    "MediaPipe",
    "webcam game",
    "Ankush Karmakar",
  ],
  openGraph: {
    type: "website",
    siteName: "Meteor Dash",
    title: "Meteor Dash — Hand-Gesture Space Arcade",
    description:
      "Steer your rocket through asteroid belts with hand gestures. Graze for combos, grab power-ups, and beat the guardians.",
    images: [
      {
        url: "/Images/og-meteordash.png",
        width: 1200,
        height: 630,
        alt: "Meteor Dash — hand-gesture space arcade",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Meteor Dash — Hand-Gesture Space Arcade",
    description:
      "Steer your rocket through asteroid belts with hand gestures. Graze for combos, grab power-ups, and beat the guardians.",
    images: ["/Images/og-meteordash.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={robotoMono.className}>{children}</body>
    </html>
  );
}
