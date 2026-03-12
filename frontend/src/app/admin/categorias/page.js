"use client";

import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import ProtectedRoute from "../../components/protectedRoute";
import CustomDialog from "../../components/CustomDialog";
import Swal from "sweetalert2";

async function getCategorias() {
    const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/list`;
    const response = await fetch(url);
    const data = await response.json();
    return data.categorias || [];
}

export default function CategoriasPage() {
    return (
        <ProtectedRoute rolesRequired={["Admin"]}>
            {() => <Categorias />}
        </ProtectedRoute>
    );
}

function Categorias() {
    const [categorias, setCategorias] = useState([]);
    const [newName, setNewName] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [selectedCategoria, setSelectedCategoria] = useState(null);

    useEffect(() => {
        const fetchCategorias = async () => {
            const data = await getCategorias();
            setCategorias(data);
        };

        fetchCategorias();
    }, []);

    const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
    };

    const handleCreateCategoria = async () => {
        if (!newName.trim()) {
            Swal.fire("Campos obrigatórios", "Introduz o nome da categoria.", "warning");
            return;
        }

        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/categoria/create`;
            const response = await fetch(url, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ name: newName.trim() }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Erro ao criar categoria");
            }

            setCategorias((prev) => [...prev, payload.categoria].sort((a, b) => a.name.localeCompare(b.name)));
            setNewName("");

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

    const handleActionSelect = async (action, categoria) => {
        if (action === "Editar") {
            setSelectedCategoria(categoria);
            setEditName(categoria.name);
            setDialogOpen(true);
            return;
        }

        if (action === "Eliminar") {
            const result = await Swal.fire({
                title: `Eliminar categoria "${categoria.name}"`,
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
                        Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
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

    const handleUpdateCategoria = async () => {
        if (!selectedCategoria) return;

        if (!editName.trim()) {
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
                headers: authHeaders,
                body: JSON.stringify({ name: editName.trim() }),
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

            setDialogOpen(false);
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

    const columns = [{ accessorKey: "name", header: "Nome da Categoria" }];
    const categoriasComAcoes = categorias.map((categoria) => ({
        ...categoria,
        actions: ["Editar", "Eliminar"],
    }));

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            <div className="flex-1 p-4 sm:p-8 overflow-auto">
                <h1 className="text-xl font-semibold mb-8 sm:text-2xl text-center sm:text-left mt-1 sm:mt-0">
                    Gestão de Categorias
                </h1>

                <div className="grid grid-cols-1 gap-6">
                    <div className="p-6 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
                        <h2 className="font-semibold mb-4">Nova categoria</h2>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
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
                    </div>

                    <div className="p-6 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
                        <h2 className="font-semibold mb-4">Categorias</h2>
                        <DataTable
                            data={categoriasComAcoes}
                            columns={columns}
                            onAction={handleActionSelect}
                            searchFields={["name"]}
                            showInvite={false}
                            searchPlaceholder="Pesquisar por nome da categoria..."
                        />
                    </div>
                </div>
            </div>

            <CustomDialog
                title={selectedCategoria ? `Editar ${selectedCategoria.name}` : ""}
                description="Atualize o nome da categoria:"
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) setSelectedCategoria(null);
                }}
                onConfirm={handleUpdateCategoria}
                confirmLabel="Guardar"
                cancelLabel="Cancelar"
            >
                <div className="flex flex-col gap-2 mt-2">
                    <label className="text-sm font-medium text-foreground">Nome da Categoria:</label>
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-background border border-border text-foreground px-2 py-1 rounded"
                    />
                </div>
            </CustomDialog>
        </div>
    );
}
