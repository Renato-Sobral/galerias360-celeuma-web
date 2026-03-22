"use client";

import React, { useEffect } from "react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CustomDialog({
  trigger = null,
  title = "Confirmação",
  description = "",
  children,
  onConfirm = () => { },
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  open,
  onOpenChange,
  overlayClassName,
  contentClassName,
  headerClassName,
  bodyClassName,
  footerClassName,
  nonModal = false,
  closeOnInteractOutside = true,
}) {
  // 🔧 Corrigir pointer-events: none após fechar
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const body = document.body;
      const dialogOpen = document.querySelector("[data-state='open']");

      if (!dialogOpen) {
        if (body.style.overflow === "hidden") body.style.overflow = "";
        if (body.style.pointerEvents === "none") body.style.pointerEvents = "";
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => observer.disconnect();
  }, []);

  if (nonModal) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

        <DialogContent
          overlayClassName={overlayClassName}
          className={cn("max-h-[90vh] overflow-hidden", contentClassName)}
          onInteractOutside={(event) => {
            if (!closeOnInteractOutside) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (!closeOnInteractOutside) event.preventDefault();
          }}
        >
          <DialogHeader className={headerClassName}>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {children && <div className={cn("mt-2 overflow-y-auto", bodyClassName)}>{children}</div>}

          <DialogFooter className={footerClassName}>
            <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
              {cancelLabel}
            </Button>
            <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}

      <AlertDialogContent
        overlayClassName={overlayClassName}
        className={cn("max-h-[90vh] overflow-hidden", contentClassName)}
      >
        <AlertDialogHeader className={headerClassName}>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>

        {children && <div className={cn("mt-2 overflow-y-auto", bodyClassName)}>{children}</div>}

        <AlertDialogFooter className={footerClassName}>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
