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
      <head />
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LayoutClientWrapper>{children}</LayoutClientWrapper>
        </ThemeProvider>
      </body>
    </html>
  )
}
