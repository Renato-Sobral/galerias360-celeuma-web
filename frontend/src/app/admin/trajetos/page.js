"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "../../components/DataTable";
import ProtectedRoute from "../../components/protectedRoute";
import CustomDialog from "../../components/CustomDialog";
import Swal from "sweetalert2";

async function getTrajetos() {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/trajeto/list`;
  const res = await fetch(url);
  const data = await res.json();
  return data.trajetos;
}

export default function TrajetosPage() {
  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor", "Editor Percurso"]}>
      {(userRole) => <Trajetos userRole={userRole} />}
    </ProtectedRoute>
  );
}

function Trajetos({ userRole }) {
  const [trajetos, setTrajetos] = useState([]);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedTrajeto, setSelectedTrajeto] = useState(null);
  const [descricaoEdit, setDescricaoEdit] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      const data = await getTrajetos();
      setTrajetos(data);
    }
    fetchData();
  }, []);

  const handleDelete = async (trajeto) => {
    if (!trajeto.id_rota) {
      Swal.fire({
        title: "Erro",
        text: "ID da rota não está definido.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
      return;
    }

    const result = await Swal.fire({
      title: `Eliminar Rota`,
      text: `Confirmar eliminação da Rota ID ${trajeto.id_rota} e seus trajetos?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#171717",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/trajeto/rota/delete/${trajeto.id_rota}`;
      const res = await fetch(url, {
        method: "DELETE",
      });
      if (res.ok) {
        setTrajetos((prev) => prev.filter((t) => t.id_rota !== trajeto.id_rota));
        Swal.fire({
          title: "Eliminado!",
          text: "Rota e trajetos foram removidos com sucesso.",
          icon: "success",
          confirmButtonColor: "#171717",
        });
      } else {
        Swal.fire({
          title: "Erro",
          text: "Erro ao eliminar rota e trajetos.",
          icon: "error",
          confirmButtonColor: "#171717",
        });
      }
    } catch (error) {
      console.error("Erro ao eliminar rota e trajetos:", error);
      Swal.fire({
        title: "Erro",
        text: "Erro ao eliminar rota e trajetos.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const handleActionSelect = (action, trajeto) => {
    if (action === "Eliminar") {
      handleDelete(trajeto);
    } else if (action === "Adicionar vídeo") {
      setSelectedTrajeto(trajeto);
      setSelectedFile(null);
      setUploadDialogOpen(true);
    } else if (action === "Editar") {
      setSelectedTrajeto(trajeto);
      setDescricaoEdit(trajeto.description || "");
      setEditDialogOpen(true);
    }
  };

  const handleConfirmEditDescricao = async () => {
  if (!descricaoEdit.trim()) {
    Swal.fire({
      title: "Campos obrigatórios",
      text: "A descrição não pode estar vazia.",
      icon: "warning",
      confirmButtonColor: "#171717",
    });
    return;
  }

  const result = await Swal.fire({
    title: "Confirmar alteração",
    text: "Tens a certeza que queres alterar a descrição deste trajeto?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Sim, alterar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#171717",
    cancelButtonColor: "#6b7280",
  });

  if (!result.isConfirmed) return;

  try {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/trajeto/update-description/${selectedTrajeto.id_trajeto}`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: descricaoEdit }),
    });
    if (res.ok) {
      setTrajetos((prev) =>
        prev.map((t) =>
          t.id_trajeto === selectedTrajeto.id_trajeto ? { ...t, description: descricaoEdit } : t
        )
      );
      setEditDialogOpen(false);
      setSelectedTrajeto(null);
      Swal.fire({
        title: "Atualizado!",
        text: "Descrição atualizada com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } else {
      Swal.fire({
        title: "Erro",
        text: "Erro ao atualizar descrição.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  } catch (error) {
    console.error("Erro ao atualizar descrição:", error);
    Swal.fire({
      title: "Erro",
      text: "Erro ao atualizar descrição.",
      icon: "error",
      confirmButtonColor: "#171717",
    });
  }
};

  const handleConfirmUploadVideo = async () => {
    if (!selectedFile) {
      Swal.fire({
        title: "Campos obrigatórios",
        text: "Selecione um ficheiro de vídeo para enviar.",
        icon: "warning",
        confirmButtonColor: "#171717",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("video", selectedFile);

      const url = `${process.env.NEXT_PUBLIC_API_URL}/trajeto/upload-video/${selectedTrajeto.id_trajeto}`;
      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setTrajetos((prev) =>
          prev.map((t) =>
            t.id_trajeto === selectedTrajeto.id_trajeto ? { ...t, video: data.videoPath } : t
          )
        );
        setUploadDialogOpen(false);
        setSelectedTrajeto(null);
        setSelectedFile(null);
        Swal.fire({
          title: "Enviado!",
          text: "Vídeo carregado com sucesso.",
          icon: "success",
          confirmButtonColor: "#171717",
        });
      } else {
        Swal.fire({
          title: "Erro",
          text: "Erro ao enviar vídeo.",
          icon: "error",
          confirmButtonColor: "#171717",
        });
      }
    } catch (error) {
      console.error("Erro ao enviar vídeo:", error);
      Swal.fire({
        title: "Erro",
        text: "Erro ao enviar vídeo.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const trajetosFormatados = trajetos.map((t) => {
    const baseActions = ["Editar", "Adicionar vídeo"];
    const actions = userRole === "Admin" ? [...baseActions, "Eliminar"] : baseActions;

    return {
      ...t,
      id_rota: t.id_rota,
      rotaName: t.rota?.name || "Sem nome da rota",
      description: t.description || "Sem descrição",
      pontosNomes: t.pontos?.map((p) => p.name).join(", ") || "Sem pontos",
      video: t.video || "",
      actions,
    };
  });

  const columns = [
    { accessorKey: "rotaName", header: "Nome da Rota" },
    { accessorKey: "description", header: "Descrição do Trajeto" },
    { accessorKey: "pontosNomes", header: "Pontos Associados" },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex-1 p-4 sm:p-8 overflow-auto">
        <h1 className="text-xl font-semibold mb-8 sm:text-2xl text-center sm:text-left mt-1 sm:mt-0">
          Gestão de Trajetos
        </h1>
        <div className="grid grid-cols-1 gap-6">
          <div className="p-6 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
            <h2 className="font-semibold mb-4">Trajetos</h2>
            <DataTable
              data={trajetosFormatados}
              columns={columns}
              onAction={handleActionSelect}
              searchFields={["rotaName", "description", "pontosNomes"]}
              showInvite={false}
              searchPlaceholder="Pesquisar por rota, descrição ou pontos..."
            />
          </div>
        </div>
      </div>

      <CustomDialog
        title={selectedTrajeto ? `Editar descrição do trajeto` : ""}
        description="Altere a descrição do trajeto:"
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setSelectedTrajeto(null);
        }}
        onConfirm={handleConfirmEditDescricao}
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
      >
        <textarea
          value={descricaoEdit}
          onChange={(e) => setDescricaoEdit(e.target.value)}
          className="w-full bg-background border border-border rounded px-3 py-2 text-foreground placeholder:text-muted-foreground resize-y"
          rows={5}
          placeholder="Descrição do trajeto"
        />
      </CustomDialog>

      <CustomDialog
        title={selectedTrajeto ? `Upload de vídeo para o trajeto` : ""}
        description="Selecione um ficheiro de vídeo para enviar ao servidor:"
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setSelectedTrajeto(null);
            setSelectedFile(null);
          }
        }}
        onConfirm={handleConfirmUploadVideo}
        confirmLabel="Enviar"
        cancelLabel="Cancelar"
      >
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          className="w-full"
        />
        {selectedFile && (
          <p className="mt-2 text-sm text-muted-foreground">
            Ficheiro selecionado: {selectedFile.name}
          </p>
        )}
      </CustomDialog>
    </div>
  );
}
