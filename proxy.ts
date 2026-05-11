import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const userAgent = request.headers.get("user-agent") || "";

  // Block common bot/scanner paths
  const blockedPaths = [
    "/wp-admin",
    "/wp-login",
    "/admin",
    "/phpmyadmin",
    "/xmlrpc.php",
    "/.env",
    "/config.php",
    "/api/.env",
    "/vendor/phpunit",
    "/owa/auth",
    "/Autodiscover",
    "/ecp",
    "/rpc",
    "/_ignition",
    "/sitemap.xml",
    "/admin.php",
    "/login.php",
    "/config",
    "/.git",
    "/.svn",
    "/.htaccess",
    "/robots.txt",
    "/crossdomain.xml",
    "/clientaccesspolicy.xml",
  ];

  // Block if path starts with any blocked prefix
  const isBlocked = blockedPaths.some((blocked) =>
    path.toLowerCase().startsWith(blocked.toLowerCase()) ||
    path.toLowerCase().includes(blocked.toLowerCase())
  );

  // Block common exploit file extensions
  const blockedExtensions = [
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
    ".jspx",
    ".py",
    ".pl",
    ".cgi",
    ".sh",
    ".bak",
    ".old",
    ".orig",
    ".save",
    ".swp",
    ".zip",
    ".tar.gz",
    ".sql",
    ".db",
    ".sqlite",
  ];

  const hasBlockedExt = blockedExtensions.some((ext) =>
    path.toLowerCase().endsWith(ext.toLowerCase())
  );

  if (isBlocked || hasBlockedExt) {
    console.log(`[BLOCKED] ${request.method} ${path} - ${userAgent.slice(0, 50)}`);
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
