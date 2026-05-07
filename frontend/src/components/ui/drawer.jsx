"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

const Drawer = ({ open, onOpenChange, children }) => {
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "auto"
        }
        return () => {
            document.body.style.overflow = "auto"
        }
    }, [open])

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-50 bg-black/50"
                    onClick={() => onOpenChange?.(false)}
                />
            )}
            {children}
        </>
    )
}

const DrawerContent = React.forwardRef(
    ({ className, open, onOpenChange, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(
                "fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] rounded-t-2xl bg-background border-t border-border shadow-lg transition-transform duration-300 ease-out",
                open === false && "translate-y-full",
                className
            )}
            {...props}
        />
    )
)
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({ className, ...props }) => (
    <div
        className={cn("p-4 pb-3 border-b border-border", className)}
        {...props}
    />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerTitle = ({ className, ...props }) => (
    <h2 className={cn("text-lg font-semibold leading-none", className)} {...props} />
)
DrawerTitle.displayName = "DrawerTitle"

const DrawerDescription = ({ className, ...props }) => (
    <p
        className={cn("text-sm text-muted-foreground mt-1", className)}
        {...props}
    />
)
DrawerDescription.displayName = "DrawerDescription"

export { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription }
