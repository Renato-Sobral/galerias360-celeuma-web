"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "../../components/DataTable";
import ProtectedRoute from "../../components/protectedRoute";
import CustomDialog from "../../components/CustomDialog";
import Swal from "sweetalert2";

// Função para buscar os pontos
async function getPontos() {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/list`;
  const response = await fetch(url);
  const data = await response.json();
  return data.pontos;
}

// Página protegida que permite Admin e Editor
export default function PontosPage() {
  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor", "Editor Locais"]}>
      {(userRole) => <Pontos userRole={userRole} />}
    </ProtectedRoute>
  );
}

// Componente principal
function Pontos({ userRole }) {
  const [pontos, setPontos] = useState([]);
  const [selectedPonto, setSelectedPonto] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      const data = await getPontos();
      setPontos(data);
    };
    fetchData();
  }, []);

  const handleActionSelect = (action, ponto) => {
    if (action === "Visualizar") {
      router.push(`/view/p/${ponto.id_ponto}`);
    } else if (action === "Editar") {
      setSelectedPonto(ponto);
      setEditName(ponto.name);
      setEditDescription(ponto.description);
      setDialogOpen(true);
    } else if (action === "Hotspots") {
      router.push(`/admin/pontos/hotspots/${ponto.id_ponto}`);
    } else if (action === "Eliminar") {
      Swal.fire({
        title: `Eliminar "${ponto.name}"`,
        text: "Tem a certeza que queres apagar este ponto? Esta ação é irreversível.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#171717",
        cancelButtonColor: "#6b7280",
      }).then((result) => {
        if (result.isConfirmed) {
          handleDeletePonto(ponto.id_ponto);
        }
      });
    }
  };

  const handleDeletePonto = async (id_ponto) => {
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/delete/${id_ponto}`;
      const response = await fetch(url, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao apagar o ponto.");
      }

      setPontos((prev) => prev.filter((p) => p.id_ponto !== id_ponto));

      Swal.fire({
        title: "Eliminado!",
        text: "O ponto foi removido com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (error) {
      console.error("Erro ao apagar ponto:", error);
      Swal.fire("Erro", "Erro ao apagar ponto.", "error");
    }
  };

  const handleConfirmEdit = async () => {
    const result = await Swal.fire({
      title: "Guardar alterações?",
      text: "Tens a certeza que queres guardar as alterações neste ponto?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#171717",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      const formData = new FormData();
      formData.append("name", editName);
      formData.append("description", editDescription);
      formData.append("latitude", selectedPonto.latitude);
      formData.append("longitude", selectedPonto.longitude);
      if (editImage) {
        formData.append("image", editImage);
      }

      const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/update/${selectedPonto.id_ponto}`;
      await fetch(url, {
        method: "PATCH",
        body: formData,
      });

      setPontos((prev) =>
        prev.map((p) =>
          p.id_ponto === selectedPonto.id_ponto
            ? { ...p, name: editName, description: editDescription }
            : p
        )
      );

      setDialogOpen(false);
      Swal.fire({
        title: "Atualizado!",
        text: "O ponto foi editado com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (error) {
      console.error("Erro ao atualizar ponto:", error);
      Swal.fire({
        title: "Erro",
        text: "Erro ao atualizar ponto.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const columns = [
    { accessorKey: "name", header: "Nome" },
    { accessorKey: "description", header: "Descrição" },
    { accessorKey: "latitude", header: "Latitude" },
    { accessorKey: "longitude", header: "Longitude" },
  ];

  const pontosComAcoes = pontos.map((ponto) => {
    const baseActions = ["Visualizar", "Editar"];
    const isAdmin = userRole === "Admin";
    const actions = isAdmin ? [...baseActions, "Hotspots", "Eliminar"] : baseActions;
    return { ...ponto, actions };
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex-1 p-4 sm:p-8 overflow-auto">
        <h1 className="text-xl font-semibold mb-8 sm:text-2xl text-center sm:text-left mt-1 sm:mt-0">
          Gestão de Pontos
        </h1>
        <div className="grid grid-cols-1 gap-6">
          <div className="p-6 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
            <h2 className="font-semibold mb-4">Pontos</h2>
            <DataTable
              data={pontosComAcoes}
              columns={columns}
              onAction={handleActionSelect}
              searchFields={["name", "latitude", "longitude"]}
              showInvite={false}
              searchPlaceholder="Pesquisar por nome ou pelas coordenadas..."
            />
          </div>
        </div>
      </div>

      <CustomDialog
        title={selectedPonto ? `Editar ${selectedPonto.name}` : ""}
        description="Altere os campos abaixo:"
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedPonto(null);
        }}
        onConfirm={handleConfirmEdit}
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
      >
        {selectedPonto && (
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium text-foreground">Nome do Ponto:</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-background border border-border text-foreground px-2 py-1 rounded placeholder:text-muted-foreground"
            />

            <label className="text-sm font-medium text-foreground">Descrição:</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="bg-background border border-border text-foreground px-2 py-1 rounded placeholder:text-muted-foreground"
            />

            <label className="text-sm font-medium text-foreground">Carregar Imagem (opcional):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEditImage(e.target.files[0])}
              className="text-sm file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-muted file:text-foreground hover:file:bg-muted/70 file:cursor-pointer"
            />
          </div>
        )}
      </CustomDialog>
    </div>
  );
}
