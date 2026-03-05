"use client"

import React from "react"
import {
  LogOutIcon,
  UserCircleIcon,
  Sun,
  Moon,
  Monitor,
  CheckIcon,
} from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"

export function User({ user }) {
  const { setTheme, theme } = useTheme()
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    window.location.href = "/login"
  }

  const handleNavigateToProfile = () => {
    router.push("/profile")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full gap-2 px-3 py-2 rounded-md text-sm text-foreground hover:bg-muted"
        >
          <Avatar className="h-8 w-8 rounded-lg grayscale">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="rounded-lg">{user.name?.[0] || "U"}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="min-w-56 rounded-lg overflow-hidden"
        align="end"
        side="right"
        sideOffset={11}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="rounded-lg">{user.name?.[0] || "U"}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleNavigateToProfile} className="flex items-center gap-2">
          <UserCircleIcon className="mr-2 h-4 w-4" />
          Perfil
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
            {theme === "light" && <Sun className="mr-2 h-4 w-4" />}
            {theme === "dark" && <Moon className="mr-2 h-4 w-4" />}
            {theme === "system" && <Monitor className="mr-2 h-4 w-4" />}
            <span>Tema</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44 overflow-hidden -translate-y-1.5 theme-submenu max-h-72 overflow-y-auto" sideOffset={7}>
            {/* Modo claro / escuro / sistema */}
            <DropdownMenuLabel className="text-xs text-muted-foreground py-1">Modo</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />
              Light
              {theme === "light" && <CheckIcon className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />
              Dark
              {theme === "dark" && <CheckIcon className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />
              System
              {theme === "system" && <CheckIcon className="ml-auto h-4 w-4" />}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-500 cursor-pointer"
        >
          <LogOutIcon className="mr-2 h-4 w-4" />
          Terminar Sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
