"use client"

import Sidebar from "./components/sidebar"
import { usePathname } from "next/navigation"
import ThemePresetProvider from "./components/themePresetProvider"

export default function LayoutClientWrapper({ children }) {
  const pathname = usePathname()
  const esconderSidebar = pathname === "/login" || pathname === "/registo" || pathname === "/" || pathname.startsWith("/convite")

  return (
    <ThemePresetProvider>
      <div className="flex min-h-screen">
        {!esconderSidebar && <Sidebar />}
        <main className="flex-1">{children}</main>
      </div>
    </ThemePresetProvider>
  )
}
