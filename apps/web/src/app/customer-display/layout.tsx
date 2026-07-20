import { Bricolage_Grotesque, Space_Mono } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export default function CustomerDisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${bricolage.variable} ${spaceMono.variable} h-full`}>
      {children}
    </div>
  );
}
