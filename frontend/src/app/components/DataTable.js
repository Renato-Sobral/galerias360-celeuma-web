"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import DropdownMulti from "../components/dropdown";
import DropdownSingle from "../components/select";

export default function DataTable({
  data,
  columns,
  searchFields = [],
  onView,
  onAction,
  actionsKey = "actions",
  showSearch = true,
  showColumnFilters = true,
  searchPlaceholder = "Pesquisar...",
  showInvite = false,
  onInvite,
}) {
  const [sorting, setSorting] = React.useState({
    key: columns[0]?.accessorKey || "",
    direction: "asc",
  });
  const [pageIndex, setPageIndex] = React.useState(0);
  const [searchValue, setSearchValue] = React.useState("");
  const [visibleColumns, setVisibleColumns] = React.useState(
    Object.fromEntries(columns.map((col) => [col.accessorKey, true]))
  );
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const router = useRouter();

  const handleSort = React.useCallback((key) => {
    if (!key) return;
    const direction =
      sorting.key === key && sorting.direction === "asc" ? "desc" : "asc";
    setSorting({ key, direction });
  }, [sorting]);

  const processedData = React.useMemo(() => {
    const { key, direction } = sorting;
    const sorted = [...data].sort((a, b) => {
      if (!key) return 0;
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    if (!(searchFields.length && showSearch)) return sorted;

    return sorted.filter((row) =>
      searchFields.some((field) =>
        String(row[field] || "")
          .toLowerCase()
          .includes(searchValue.toLowerCase())
      )
    );
  }, [data, sorting.key, sorting.direction, searchFields, showSearch, searchValue]);

  const startIndex = pageIndex * rowsPerPage;
  const paginatedData = React.useMemo(
    () => processedData.slice(startIndex, startIndex + rowsPerPage),
    [processedData, startIndex, rowsPerPage]
  );

  React.useEffect(() => {
    setPageIndex(0);
  }, [searchValue, rowsPerPage, data.length]);

  return (
    <div className="text-foreground">
      {(showSearch || showColumnFilters || showInvite) && (
        <div className="w-full flex flex-col xl:flex-row xl:items-start xl:justify-between gap-2 mb-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 w-full min-w-0">
            {showSearch && searchFields.length > 0 && (
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="min-w-0 w-full sm:w-[220px] lg:w-[280px] xl:w-[320px] px-2 py-1.5 text-sm bg-background text-foreground border border-border rounded-lg focus:outline-none"
              />
            )}

            {showColumnFilters && (
              <DropdownMulti
                label="Colunas"
                width="w-full sm:w-[120px]"
                selectedValues={Object.keys(visibleColumns).filter(
                  (col) => visibleColumns[col]
                )}
                onSelect={(newSelected) => {
                  const updated = Object.fromEntries(
                    Object.keys(visibleColumns).map((col) => [
                      col,
                      newSelected.includes(col),
                    ])
                  );
                  setVisibleColumns(updated);
                }}
                items={Object.keys(visibleColumns).map((col) => ({
                  label: col.charAt(0).toUpperCase() + col.slice(1),
                  value: col,
                }))}
              />
            )}
          </div>

          {showInvite && (
            <div className="w-full xl:w-auto flex justify-end">
              <Button onClick={onInvite} className="h-full whitespace-nowrap w-full sm:w-auto">
                Convidar Utilizador
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border border-border bg-card text-card-foreground overflow-x-auto">
        <div className="min-w-[600px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(
                  (col, index) =>
                    visibleColumns[col.accessorKey] && (
                      <TableHead key={col.accessorKey}>
                        {index === 0 ? (
                          <Button
                            variant="ghost"
                            className="flex items-center"
                            onClick={() => handleSort(col.accessorKey)}
                          >
                            {col.header}
                            {sorting.key === col.accessorKey &&
                              (sorting.direction === "asc" ? (
                                <ArrowUpDown className="ml-2" />
                              ) : (
                                <ArrowUpDown className="ml-2 rotate-180" />
                              ))}
                          </Button>
                        ) : (
                          col.header
                        )}
                      </TableHead>
                    )
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, index) => (
                  <TableRow key={index}>
                    {columns.map(
                      (col) =>
                        visibleColumns[col.accessorKey] && (
                          <TableCell key={col.accessorKey}>
                            {col.render
                              ? col.render(row[col.accessorKey], row)
                              : typeof row[col.accessorKey] === "object" &&
                                row[col.accessorKey] !== null
                                ? JSON.stringify(row[col.accessorKey])
                                : row[col.accessorKey]}
                          </TableCell>
                        )
                    )}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          {(row[actionsKey] || []).map((action) => {
                            if (action === "Visualizar") {
                              return (
                                <DropdownMenuItem
                                  key={action}
                                  onClick={() =>
                                    onView
                                      ? onView(row)
                                      : router.push(`/view/p/${row.id_ponto}`)
                                  }
                                >
                                  {action}
                                </DropdownMenuItem>
                              );
                            }

                            return (
                              <DropdownMenuItem
                                key={action}
                                onClick={() => {
                                  if (onAction) onAction(action, row);
                                }}
                              >
                                {action}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow key="no-data">
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum ponto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="w-full flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center py-4 mt-[-0.5rem]">
        <div className="flex justify-between items-center w-full">
          <span className="text-sm text-muted-foreground">
            Página {pageIndex + 1} de{" "}
            {Math.max(1, Math.ceil(processedData.length / rowsPerPage))}
          </span>

          <div className="flex items-center gap-2 mt-2 mr-0 sm:mr-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <DropdownSingle
              label={`${rowsPerPage}`}
              items={[
                { label: "5", value: "5" },
                { label: "10", value: "10" },
                { label: "15", value: "15" },
                { label: "20", value: "20" },
                { label: "25", value: "25" },
              ]}
              onSelect={(value) => {
                setPageIndex(0);
                setRowsPerPage(Number(value));
              }}
              width="w-[60px]"
              height="h-[2rem]"
            />
            <span className="text-sm text-muted-foreground">linhas</span>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-2 mb-[-8px] sm:mt-0 sm:mb-0">
          <Button
            variant="outline"
            size="sm"
            className="w-1/2 sm:w-auto"
            onClick={() => setPageIndex(pageIndex - 1)}
            disabled={pageIndex === 0}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-1/2 sm:w-auto"
            onClick={() => setPageIndex(pageIndex + 1)}
            disabled={(pageIndex + 1) * rowsPerPage >= processedData.length}
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}
