"use client";

import { useMemo, useState } from "react";

export default function MultiCategoryPicker({
    categorias = [],
    selectedIds = [],
    onChange,
    placeholder = "Pesquisar categoria...",
    emptyLabel = "Sem categorias disponíveis",
    allowCreate = false,
    createPlaceholder = "Nova categoria...",
    createButtonLabel = "Adicionar categoria",
    onCreateCategory,
}) {
    const [query, setQuery] = useState("");
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState("");
    const [createdCategorias, setCreatedCategorias] = useState([]);

    const categoriasDisponiveis = useMemo(() => {
        const merged = [...createdCategorias, ...categorias];
        const byId = new Map();

        merged.forEach((categoria) => {
            if (!categoria) return;
            const key = String(categoria.id_categoria ?? categoria.name);
            if (!byId.has(key)) {
                byId.set(key, categoria);
            }
        });

        return Array.from(byId.values());
    }, [categorias, createdCategorias]);

    const filteredCategorias = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return categoriasDisponiveis;
        return categoriasDisponiveis.filter((categoria) =>
            String(categoria.name || "").toLowerCase().includes(normalized)
        );
    }, [categoriasDisponiveis, query]);

    const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

    const toggleCategoria = (id) => {
        const asString = String(id);
        const next = selectedSet.has(asString)
            ? selectedIds.filter((value) => String(value) !== asString)
            : [...selectedIds, asString];
        onChange?.(next);
    };

    const removeCategoria = (id) => {
        const asString = String(id);
        onChange?.(selectedIds.filter((value) => String(value) !== asString));
    };

    const handleCreateCategory = async () => {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName || !onCreateCategory || isCreating) return;

        setIsCreating(true);
        setCreateError("");

        try {
            const categoriaCriada = await onCreateCategory(trimmedName);
            if (!categoriaCriada?.id_categoria) {
                throw new Error("Categoria criada sem identificador válido.");
            }

            setCreatedCategorias((prev) => {
                const exists = prev.some((categoria) => String(categoria.id_categoria) === String(categoriaCriada.id_categoria));
                if (exists) return prev;
                return [categoriaCriada, ...prev];
            });
            setNewCategoryName("");

            const createdId = String(categoriaCriada.id_categoria);
            if (!selectedSet.has(createdId)) {
                onChange?.([...selectedIds, createdId]);
            }
        } catch (error) {
            setCreateError(error.message || "Não foi possível criar a categoria.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-2">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-background border border-border text-foreground px-3 py-2 rounded text-sm"
            />

            {allowCreate && (
                <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder={createPlaceholder}
                            className="w-full bg-background border border-border text-foreground px-3 py-2 rounded text-sm"
                        />
                        <button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={isCreating || !newCategoryName.trim()}
                            className="shrink-0 rounded-md bg-foreground px-3 py-2 text-xs font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isCreating ? "A criar..." : createButtonLabel}
                        </button>
                    </div>

                    {createError && <p className="text-xs text-red-600">{createError}</p>}
                </div>
            )}

            {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selectedIds.map((id) => {
                        const categoria = categoriasDisponiveis.find((item) => String(item.id_categoria) === String(id));
                        const name = categoria?.name || `#${id}`;
                        return (
                            <button
                                key={String(id)}
                                type="button"
                                onClick={() => removeCategoria(id)}
                                className="text-xs px-2 py-1 rounded-full border border-border bg-muted hover:bg-muted/70"
                                title="Remover categoria"
                            >
                                {name} x
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="border border-border rounded-md max-h-40 overflow-y-auto p-2 space-y-1 bg-background">
                {filteredCategorias.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">{emptyLabel}</p>
                ) : (
                    filteredCategorias.map((categoria) => {
                        const isChecked = selectedSet.has(String(categoria.id_categoria));
                        return (
                            <label
                                key={categoria.id_categoria}
                                className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleCategoria(categoria.id_categoria)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm text-foreground">{categoria.name}</span>
                            </label>
                        );
                    })
                )}
            </div>
        </div>
    );
}
