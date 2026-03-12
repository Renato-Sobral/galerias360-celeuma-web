"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

export default function MultiCategoryPicker({
    categorias = [],
    selectedIds = [],
    onChange,
    placeholder = "Pesquisar categoria...",
    emptyLabel = "Sem categorias disponíveis",
    allowCreate = false,
    createPlaceholder = "Nova categoria...",
    createButtonLabel = "+",
    onCreateCategory,
}) {
    const [query, setQuery] = useState("");
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
    const trimmedQuery = query.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const canCreateFromQuery = allowCreate && !!normalizedQuery && !categoriasDisponiveis.some(
        (categoria) => String(categoria.name || "").trim().toLowerCase() === normalizedQuery
    );

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
        const trimmedName = trimmedQuery;
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
            setQuery("");

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
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && canCreateFromQuery) {
                            e.preventDefault();
                            handleCreateCategory();
                        }
                    }}
                    placeholder={allowCreate ? `${placeholder} / ${createPlaceholder}` : placeholder}
                    className="w-full rounded border border-border bg-background py-2 pl-9 pr-11 text-sm text-foreground"
                />
                {allowCreate && canCreateFromQuery && (
                    <button
                        type="button"
                        onClick={handleCreateCategory}
                        disabled={isCreating}
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-foreground text-background disabled:cursor-not-allowed disabled:opacity-50"
                        title={isCreating ? "A criar categoria" : `Criar categoria: ${trimmedQuery}`}
                    >
                        {isCreating ? createButtonLabel : <Plus className="h-4 w-4" />}
                    </button>
                )}
            </div>

            {createError && <p className="text-xs text-red-600">{createError}</p>}

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
