"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MenuIcon, XIcon, LayoutDashboard, Map, MapPin, Waypoints, Home, Edit, Palette } from "lucide-react"
import { User } from "../components/user"
import TooltipWrapper from "../components/TooltipWrapper"
import { getUserDataFromToken } from "../components/jwtDecode"
import Logo from "./logo"
// ThemePresetSelector moved into User dropdown

const Sidebar = () => {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const userData = getUserDataFromToken()
    if (userData) setUser(userData)
  }, [])

  const handleNavigate = (path) => {
    router.push(path)
    setIsOpen(false)
  }

  const isLoggedIn = !!user?.role
  const currentRole = user?.role

  const DASHBOARD_ROLES = ["Admin", "Editor", "Editor User", "Editor Role", "Editor Permission"]
  const PONTOS_ROLES = ["Admin", "Editor", "Editor Locais"]
  const TRAJETOS_ROLES = ["Admin", "Editor", "Editor Percurso"]
  const EDITOR_ROLES = ["Admin", "Editor"]
  const ADMIN_ONLY = ["Admin"]

  const canAccess = (allowedRoles) =>
    !!currentRole && Array.isArray(allowedRoles) && allowedRoles.includes(currentRole)

  return (
    <>
      <div className="sm:hidden absolute top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <XIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 sm:hidden" onClick={() => setIsOpen(false)} />
      )}

      <div
        className={`${isOpen ? "translate-x-0" : "-translate-x-full"
          } sm:translate-x-0 fixed sm:static top-0 left-0 h-screen w-64 sm:w-16 bg-background text-foreground border-r border-border z-50 transform transition-transform duration-300 ease-in-out flex flex-col justify-between`}
      >
        {/* Topo */}
        <div>
          <div className="inline-flex size-16 items-center justify-center">
            <button
              type="button"
              onClick={() => handleNavigate("/")}
              className="inline-flex items-center justify-center"
              aria-label="Ir para home"
            >
              <Logo width={34} height={34} />
            </button>
          </div>

          <div className="border-t border-border mx-4 my-2" />

          <div className="px-2 pt-2">
            <ul className="space-y-1">

              {!isLoggedIn && (
                <>
                  {/* HOME */}
                  <li>
                    <div className="w-full">
                      <div className="hidden sm:block">
                        <TooltipWrapper content="Home" sideOffset={12}>
                          <Button
                            variant="ghost"
                            onClick={() => handleNavigate("/")}
                            className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                            hover:bg-muted hover:text-foreground
                            ${pathname === "/" ? "sm:bg-muted sm:text-foreground" : ""}`}
                          >
                            <Home className="w-5 h-5" />
                          </Button>
                        </TooltipWrapper>
                      </div>
                      <div className="sm:hidden">
                        <Button
                          variant="ghost"
                          onClick={() => handleNavigate("/")}
                          className={`flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2`}
                        >
                          <Home className="w-5 h-5" />
                          <span className={`${isOpen ? "inline" : "hidden"}`}>Home</span>
                        </Button>
                      </div>
                    </div>
                  </li>
                </>
              )}

              {/* Itens só para utilizadores com role */}
              {isLoggedIn && (
                <>
                  {/* Dashboard */}
                  {canAccess(DASHBOARD_ROLES) && (
                    <li>
                      <div className="w-full">
                        <div className="hidden sm:block">
                          <TooltipWrapper content="Dashboard" sideOffset={12}>
                            <Button
                              variant="ghost"
                              onClick={() => handleNavigate("/admin")}
                              className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                            hover:bg-muted hover:text-foreground
                            ${pathname === "/admin" ? "sm:bg-muted sm:text-foreground" : ""}`}
                            >
                              <LayoutDashboard className="w-5 h-5" />
                            </Button>
                          </TooltipWrapper>
                        </div>
                        <div className="sm:hidden">
                          <Button
                            variant="ghost"
                            onClick={() => handleNavigate("/admin")}
                            className={`flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2`}
                          >
                            <LayoutDashboard className="w-5 h-5" />
                            <span className={`${isOpen ? "inline" : "hidden"}`}>Dashboard</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  )}

                  {/* Pontos */}
                  {canAccess(PONTOS_ROLES) && (
                    <li>
                      <div className="w-full">
                        <div className="hidden sm:block">
                          <TooltipWrapper content="Gestão de Pontos" sideOffset={12}>
                            <Button
                              variant="ghost"
                              onClick={() => handleNavigate("/admin/pontos")}
                              className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                            hover:bg-muted hover:text-foreground
                            ${pathname === "/admin/pontos" ? "sm:bg-muted sm:text-foreground" : ""}`}
                            >
                              <MapPin className="w-5 h-5" />
                            </Button>
                          </TooltipWrapper>
                        </div>
                        <div className="sm:hidden">
                          <Button
                            variant="ghost"
                            onClick={() => handleNavigate("/admin/pontos")}
                            className={`flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2`}
                          >
                            <MapPin className="w-5 h-5" />
                            <span className={`${isOpen ? "inline" : "hidden"}`}>Gestão de Pontos</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  )}

                  {/* Trajetos */}
                  {canAccess(TRAJETOS_ROLES) && (
                    <li>
                      <div className="w-full">
                        <div className="hidden sm:block">
                          <TooltipWrapper content="Gestão de Trajetos" sideOffset={12}>
                            <Button
                              variant="ghost"
                              onClick={() => handleNavigate("/admin/trajetos")}
                              className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                            hover:bg-muted hover:text-foreground
                            ${pathname?.startsWith("/admin/trajetos") ? "sm:bg-muted sm:text-foreground" : ""}`}
                            >
                              <Waypoints className="w-5 h-5" />
                            </Button>
                          </TooltipWrapper>
                        </div>
                        <div className="sm:hidden">
                          <Button
                            variant="ghost"
                            onClick={() => handleNavigate("/admin/trajetos")}
                            className={`flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2`}
                          >
                            <Waypoints className="w-5 h-5" />
                            <span className={`${isOpen ? "inline" : "hidden"}`}>Gestão de Trajetos</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  )}

                  {/* Image & Model Editor */}
                  {canAccess(EDITOR_ROLES) && (
                    <li>
                      <div className="w-full">
                        <div className="hidden sm:block">
                          <TooltipWrapper content="Editor de Imagem 360º e Modelos 3D" sideOffset={12}>
                            <Button
                              variant="ghost"
                              onClick={() => handleNavigate("/admin/editor")}
                              className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                            hover:bg-muted hover:text-foreground
                            ${pathname?.startsWith("/admin/editor") ? "sm:bg-muted sm:text-foreground" : ""}`}
                            >
                              <Edit className="w-5 h-5" />
                            </Button>
                          </TooltipWrapper>
                        </div>
                        <div className="sm:hidden">
                          <Button
                            variant="ghost"
                            onClick={() => handleNavigate("/admin/editor")}
                            className={`flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2`}
                          >
                            <Waypoints className="w-5 h-5" />
                            <span className={`${isOpen ? "inline" : "hidden"}`}>Editor de Imagem 360º e Modelos 3D</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  )}

                  {/* Personalização (apenas Admin) */}
                  {canAccess(ADMIN_ONLY) && (
                    <li>
                      <div className="w-full">
                        <div className="hidden sm:block">
                          <TooltipWrapper content="Personalização" sideOffset={12}>
                            <Button
                              variant="ghost"
                              onClick={() => handleNavigate("/admin/personalizacao")}
                              className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                            hover:bg-muted hover:text-foreground
                            ${pathname?.startsWith("/admin/personalizacao") ? "sm:bg-muted sm:text-foreground" : ""}`}
                            >
                              <Palette className="w-5 h-5" />
                            </Button>
                          </TooltipWrapper>
                        </div>
                        <div className="sm:hidden">
                          <Button
                            variant="ghost"
                            onClick={() => handleNavigate("/admin/personalizacao")}
                            className="flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2"
                          >
                            <Palette className="w-5 h-5" />
                            <span className={`${isOpen ? "inline" : "hidden"}`}>Personalização</span>
                          </Button>
                        </div>
                      </div>
                    </li>
                  )}
                </>
              )}

              <li>
                <div className="w-full">
                  <div className="hidden sm:block">
                    <TooltipWrapper content="Mapa" sideOffset={12}>
                      <Button
                        variant="ghost"
                        onClick={() => handleNavigate("/map")}
                        className={`flex justify-center w-full rounded-sm p-3 text-muted-foreground transition-colors duration-300
                        hover:bg-muted hover:text-foreground
                        ${pathname === "/map" ? "sm:bg-muted sm:text-foreground" : ""}`}
                      >
                        <Map className="w-5 h-5" />
                      </Button>
                    </TooltipWrapper>
                  </div>
                  <div className="sm:hidden">
                    <Button
                      variant="ghost"
                      onClick={() => handleNavigate("/map")}
                      className={`flex w-full rounded-sm p-3 text-muted-foreground hover:bg-muted hover:text-foreground justify-start items-center gap-2`}
                    >
                      <Map className="w-5 h-5" />
                      <span className={`${isOpen ? "inline" : "hidden"}`}>Mapa</span>
                    </Button>
                  </div>
                </div>
              </li>

            </ul>
          </div>
        </div>

        {/* Footer com user */}
        <div>
          <div className="border-t border-border mx-4 my-2" />

          <div className="p-2 flex justify-center">
            {user && <User user={user} />}
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
