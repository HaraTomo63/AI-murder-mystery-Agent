import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "AI Murder Mystery MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header className="header">
          <h1>AIマダミス MVP</h1>
          <nav className="nav">
            <Link href="/">Home</Link>
            <Link href="/auth/login">Login</Link>
            <Link href="/auth/signup">Signup</Link>
            <Link href="/me/nickname">Nickname</Link>
            <Link href="/sessions/new">New Session</Link>
            <Link href="/history">History</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
