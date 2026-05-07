"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DataTable from "../../components/DataTable";
import ProtectedRoute from "../../components/protectedRoute";
import CustomDialog from "../../components/CustomDialog";
import MediaSourceField from "../../components/MediaSourceField";
import MultiCategoryPicker from "../../components/MultiCategoryPicker";
import Swal from "sweetalert2";
import { createLibrarySelection, resolveMediaSelection } from "../../lib/media-library";

// Função para buscar os pontos
async function getPontos() {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/list`;
  const response = await fetch(url);
  const data = await response.json();
  return data.pontos;
}

async function getCategorias() {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/list`;
  const response = await fetch(url);
  const data = await response.json();
  return data.categorias || [];
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
  const isAdmin = userRole === "Admin";
  const [pontos, setPontos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [selectedPonto, setSelectedPonto] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImageSelection, setEditImageSelection] = useState(null);
  const [editCategorias, setEditCategorias] = useState([]);
  const [newCategoriaName, setNewCategoriaName] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [editCategoriaName, setEditCategoriaName] = useState("");
  const router = useRouter();

  const getAuthToken = () => localStorage.getItem("authToken") || "";
  const getAuthHeaders = () => {
    const token = getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    const fetchData = async () => {
      const [pontosData, categoriasData] = await Promise.all([getPontos(), getCategorias()]);
      setPontos(pontosData);
      setCategorias(categoriasData);
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
      const categoriasDoPonto =
        ponto?.categorias ||
        (ponto?.CategoriaPonto ? [ponto.CategoriaPonto] : []) ||
        (ponto?.categoria ? [ponto.categoria] : []);
      setEditCategorias((categoriasDoPonto || []).map((categoria) => String(categoria.id_categoria)));
      setEditImageSelection(createLibrarySelection(ponto.imagePath));
      setDialogOpen(true);
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
        headers: getAuthHeaders(),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Erro ao apagar o ponto.");
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
      const resolvedImage = await resolveMediaSelection(editImageSelection, "pontos");
      const formData = new FormData();
      formData.append("name", editName);
      formData.append("description", editDescription);
      formData.append("latitude", selectedPonto.latitude);
      formData.append("longitude", selectedPonto.longitude);
      formData.append("id_categorias", JSON.stringify(editCategorias));
      formData.append("imagePath", resolvedImage?.path || "");

      const url = `${process.env.NEXT_PUBLIC_API_URL}/ponto/update/${selectedPonto.id_ponto}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Erro ao atualizar ponto.");
      }

      setPontos((prev) =>
        prev.map((p) =>
          p.id_ponto === selectedPonto.id_ponto
            ? {
              ...p,
              name: editName,
              description: editDescription,
              categorias: categorias.filter((c) => editCategorias.includes(String(c.id_categoria))),
            }
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
        text: error.message || "Erro ao atualizar ponto.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const handleCreateCategoria = async () => {
    if (!newCategoriaName.trim()) {
      Swal.fire("Campos obrigatórios", "Introduz o nome da categoria.", "warning");
      return;
    }

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/create`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ name: newCategoriaName.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Erro ao criar categoria");
      }

      setCategorias((prev) => [...prev, payload.categoria].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoriaName("");

      Swal.fire({
        title: "Criada!",
        text: "Categoria criada com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (error) {
      Swal.fire("Erro", error.message || "Erro ao criar categoria.", "error");
    }
  };

  const handleCategoriaAction = async (action, categoria) => {
    if (action === "Editar") {
      setSelectedCategoria(categoria);
      setEditCategoriaName(categoria.name);
      setCategoriaDialogOpen(true);
      return;
    }

    if (action === "Eliminar") {
      const result = await Swal.fire({
        title: `Eliminar categoria \"${categoria.name}\"`,
        text: "Tem a certeza que queres apagar esta categoria?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#171717",
        cancelButtonColor: "#6b7280",
      });

      if (!result.isConfirmed) return;

      try {
        const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/delete/${categoria.id_categoria}`;
        const response = await fetch(url, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Erro ao eliminar categoria");
        }

        setCategorias((prev) => prev.filter((c) => c.id_categoria !== categoria.id_categoria));

        Swal.fire({
          title: "Eliminada!",
          text: "Categoria removida com sucesso.",
          icon: "success",
          confirmButtonColor: "#171717",
        });
      } catch (error) {
        Swal.fire("Erro", error.message || "Erro ao eliminar categoria.", "error");
      }
    }
  };

  const handleConfirmEditCategoria = async () => {
    if (!selectedCategoria) return;

    if (!editCategoriaName.trim()) {
      Swal.fire("Campos obrigatórios", "Introduz o nome da categoria.", "warning");
      return;
    }

    const result = await Swal.fire({
      title: "Guardar alterações?",
      text: "Pretendes atualizar esta categoria?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#171717",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/update/${selectedCategoria.id_categoria}`;
      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ name: editCategoriaName.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atualizar categoria");
      }

      setCategorias((prev) =>
        prev
          .map((categoria) =>
            categoria.id_categoria === selectedCategoria.id_categoria
              ? { ...categoria, name: payload.categoria.name }
              : categoria
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      setCategoriaDialogOpen(false);
      setSelectedCategoria(null);

      Swal.fire({
        title: "Atualizada!",
        text: "Categoria atualizada com sucesso.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (error) {
      Swal.fire("Erro", error.message || "Erro ao atualizar categoria.", "error");
    }
  };

  const columns = [
    { accessorKey: "name", header: "Nome" },
    { accessorKey: "categoriaNome", header: "Categoria" },
    { accessorKey: "description", header: "Descrição" },
    { accessorKey: "latitude", header: "Latitude" },
    { accessorKey: "longitude", header: "Longitude" },
  ];

  const getPontoCategoria = (ponto) =>
  (Array.isArray(ponto?.categorias) && ponto.categorias.length
    ? ponto.categorias
    : ponto?.CategoriaPonto
      ? [ponto.CategoriaPonto]
      : ponto?.categorias_ponto
        ? [ponto.categorias_ponto]
        : ponto?.categoria
          ? [ponto.categoria]
          : []);

  const pontosComAcoes = pontos.map((ponto) => {
    const baseActions = ["Visualizar", "Editar"];
    const isAdmin = userRole === "Admin";
    const actions = isAdmin ? [...baseActions, "Eliminar"] : baseActions;
    const categoriasPonto = getPontoCategoria(ponto);
    return {
      ...ponto,
      categoriaNome:
        categoriasPonto.length > 0
          ? categoriasPonto.map((categoria) => categoria.name).join(", ")
          : "Sem categoria",
      actions,
    };
  });

  const categoriaColumns = [{ accessorKey: "name", header: "Nome da Categoria" }];
  const categoriasComAcoes = categorias.map((categoria) => ({
    ...categoria,
    actions: ["Editar", "Eliminar"],
  }));

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
              searchFields={["name", "categoriaNome", "latitude", "longitude"]}
              showInvite={false}
              searchPlaceholder="Pesquisar por nome, categoria ou coordenadas..."
            />
          </div>

          {isAdmin && (
            <div className="p-6 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
              <h2 className="font-semibold mb-4">Categorias</h2>

              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <input
                  type="text"
                  value={newCategoriaName}
                  onChange={(e) => setNewCategoriaName(e.target.value)}
                  placeholder="Nome da categoria"
                  className="bg-background border border-border text-foreground px-3 py-2 rounded w-full"
                />
                <button
                  type="button"
                  onClick={handleCreateCategoria}
                  className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-semibold hover:opacity-90"
                >
                  Criar categoria
                </button>
              </div>

              <DataTable
                data={categoriasComAcoes}
                columns={categoriaColumns}
                onAction={handleCategoriaAction}
                searchFields={["name"]}
                showInvite={false}
                searchPlaceholder="Pesquisar categoria..."
              />
            </div>
          )}
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
        contentClassName="w-[min(96vw,1100px)] max-w-6xl gap-0 p-0"
        headerClassName="border-b border-border px-6 py-5"
        bodyClassName="px-6 py-5"
        footerClassName="border-t border-border px-6 py-4"
      >
        {selectedPonto && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome do Ponto:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-background border border-border text-foreground px-3 py-2 rounded placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Descrição:</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={6}
                  className="min-h-32 w-full resize-y bg-background border border-border text-foreground px-3 py-2 rounded placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Categorias:</label>
                <MultiCategoryPicker
                  categorias={categorias}
                  selectedIds={editCategorias}
                  onChange={setEditCategorias}
                />
              </div>
            </div>

            <div className="min-w-0">
              <MediaSourceField
                label="Imagem do ponto"
                accept="image/*"
                selection={editImageSelection}
                onChange={setEditImageSelection}
                destinationPath="pontos"
                helperText="Se escolher do dispositivo, a imagem entra primeiro no File Manager."
              />
            </div>
          </div>
        )}
      </CustomDialog>

      <CustomDialog
        title={selectedCategoria ? `Editar ${selectedCategoria.name}` : ""}
        description="Atualize o nome da categoria:"
        open={categoriaDialogOpen}
        onOpenChange={(open) => {
          setCategoriaDialogOpen(open);
          if (!open) setSelectedCategoria(null);
        }}
        onConfirm={handleConfirmEditCategoria}
        confirmLabel="Guardar"
        cancelLabel="Cancelar"
      >
        {selectedCategoria && (
          <div className="flex flex-col gap-2 mt-2">
            <label className="text-sm font-medium text-foreground">Nome da Categoria:</label>
            <input
              type="text"
              value={editCategoriaName}
              onChange={(e) => setEditCategoriaName(e.target.value)}
              className="bg-background border border-border text-foreground px-2 py-1 rounded"
            />
          </div>
        )}
      </CustomDialog>
    </div>
  );
}
