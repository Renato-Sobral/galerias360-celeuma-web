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
import { Button } from "@/components/ui/button";

export default function CustomDialog({
  trigger = null,
  title = "Confirmação",
  description = "",
  children,
  onConfirm = () => {},
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  open,
  onOpenChange,
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>

        {children && <div className="mt-2">{children}</div>}

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
