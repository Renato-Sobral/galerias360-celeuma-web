import { GeistSans } from "geist/font/sans"
import { ThemeProvider } from "@/components/theme-provider"
import LayoutClientWrapper from "./layout-client"
import "./globals.css"

export const metadata = {
  title: "Galerias 360",
  description: "Galerias 360",
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        {/* Apply cached theme and favicon immediately to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const cache = localStorage.getItem('galerias360_theme_cache');
                  if (!cache) return;
                  
                  const preset = JSON.parse(cache);
                  if (!preset) return;

                  const CSS_VAR_KEYS = [
                    "background", "foreground",
                    "card", "card-foreground",
                    "popover", "popover-foreground",
                    "primary", "primary-foreground",
                    "secondary", "secondary-foreground",
                    "muted", "muted-foreground",
                    "accent", "accent-foreground",
                    "destructive", "destructive-foreground",
                    "border", "input", "ring",
                    "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
                  ];

                  function applyVars(vars, selector) {
                    if (!vars) return;
                    const id = 'theme-preset-' + selector.replace(/[^a-z]/gi, '');
                    let style = document.getElementById(id);
                    if (!style) {
                      style = document.createElement('style');
                      style.id = id;
                      document.head.appendChild(style);
                    }
                    const lines = Object.entries(vars)
                      .filter(([k]) => CSS_VAR_KEYS.includes(k))
                      .map(([k, v]) => '  --' + k + ': ' + v + ';');
                    style.textContent = selector + ' {\\n' + lines.join('\\n') + '\\n}';
                  }

                  // Apply light theme
                  if (preset.lightVars) applyVars(preset.lightVars, ':root');
                  
                  // Apply dark theme
                  if (preset.darkVars) applyVars(preset.darkVars, '.dark');

                  // Preload logos
                  if (preset.logoLightUrl) {
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.as = 'image';
                    link.href = preset.logoLightUrl;
                    document.head.appendChild(link);
                  }
                  if (preset.logoDarkUrl) {
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.as = 'image';
                    link.href = preset.logoDarkUrl;
                    document.head.appendChild(link);
                  }

                  // Apply favicons
                  if (preset.favicon) {
                    const href = preset.favicon;
                    const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
                    rels.forEach((rel) => {
                      let link = document.head.querySelector("link[rel='" + rel + "']");
                      if (!link) {
                        link = document.createElement('link');
                        link.setAttribute('rel', rel);
                        document.head.appendChild(link);
                      }
                      link.setAttribute('href', href);
                    });
                  }
                } catch (e) {
                  // Silently fail - will load theme normally
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutClientWrapper>{children}</LayoutClientWrapper>
        </ThemeProvider>

        {/* Replace cached logos after body is rendered */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const cache = localStorage.getItem('galerias360_theme_cache');
                  if (!cache) return;
                  
                  const preset = JSON.parse(cache);
                  if (!preset) return;

                  // Use requestAnimationFrame to wait for React render
                  requestAnimationFrame(() => {
                    // Replace default logos with cached ones
                    if (preset.logoLightUrl) {
                      const imgs = document.querySelectorAll('img[src="/celeumaBlack.svg"]');
                      imgs.forEach((img) => {
                        img.src = preset.logoLightUrl;
                      });
                    }
                    if (preset.logoDarkUrl) {
                      const imgs = document.querySelectorAll('img[src="/celeuma.svg"]');
                      imgs.forEach((img) => {
                        img.src = preset.logoDarkUrl;
                      });
                    }
                  });
                } catch (e) {
                  // Silently fail
                }
              })();
            `,
          }}
        />
      </body>
    </html>
  )
}
