import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const SOCIAL_BOT_RE =
  /Twitterbot|facebookexternalhit|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot/i;

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (SOCIAL_BOT_RE.test(ua)) {
    // Serve the default locale directly — no redirect for social crawlers
    return intlMiddleware(
      new NextRequest(request.url, {
        ...request,
        headers: new Headers([
          ...Array.from(request.headers.entries()),
          ["Accept-Language", "ja"],
        ]),
      })
    );
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
