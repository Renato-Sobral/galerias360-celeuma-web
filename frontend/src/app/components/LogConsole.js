"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import DatePicker from "../components/datePicker";
import { Button } from "@/components/ui/button";
import DataTable from "../components/DataTable";

export default function LogConsole({ logs = [], logFiles = [] }) {
  const [socketLogs, setSocketLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("logs");
  const logsEndRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState({ from: undefined, to: undefined });
  const socketRef = useRef(null);
  const [pageLoaded, setPageLoaded] = useState(false);

  useEffect(() => {
    const handleLoad = () => setPageLoaded(true);

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
    }

    return () => {
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  useEffect(() => {
    if (!pageLoaded) return;
    if (socketRef.current && socketRef.current.connected) return;

    socketRef.current = io(process.env.NEXT_PUBLIC_API_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 3000,
    });

    socketRef.current.on("connect", () => {
      console.log("✅ Conectado ao WebSocket!");
    });

    socketRef.current.on("log", (data) => {
      setSocketLogs((prevLogs) => {
        const next = [...prevLogs, data.message];
        return next.length > 400 ? next.slice(-400) : next;
      });
    });

    return () => {
      console.log("🛑 Desconectando do WebSocket...");
      if (socketRef.current) {
        socketRef.current.off("log");
        socketRef.current.disconnect();
      }
    };
  }, [pageLoaded]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [socketLogs]);

  const filteredLogs = useMemo(
    () =>
      logFiles.filter((file) => {
        if (!selectedDate?.from) return true;

        const logStartDate = new Date(file.weekStartDate);
        const logEndDate = new Date(logStartDate);
        logEndDate.setDate(logStartDate.getDate() + 6);

        if (selectedDate.to) {
          return selectedDate.from <= logEndDate && selectedDate.to >= logStartDate;
        }
        return selectedDate.from >= logStartDate && selectedDate.from <= logEndDate;
      }),
    [logFiles, selectedDate]
  );

  const columns = [
    {
      header: "Log",
      accessorKey: "nome",
    },
    {
      header: "Data (Semana)",
      accessorKey: "data",
    },
  ];

  const tableData = useMemo(() => {
    const formatDate = (d) =>
      d.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

    return filteredLogs.map((file) => {
      const weekStartDate = new Date(file.weekStartDate);
      const start = new Date(weekStartDate);
      const end = new Date(weekStartDate);
      end.setDate(end.getDate() + 6);

      return {
        id_log: file.id_log,
        nome: `📃 log-${file.id_log}.txt`,
        data: `${formatDate(start)} - ${formatDate(end)}`,
        actions: ["Download"],
      };
    });
  }, [filteredLogs]);

  const handleAction = (action, row) => {
    if (action === "Download") {
      const link = document.createElement("a");
      link.href = `${process.env.NEXT_PUBLIC_API_URL}/log/logs/${row.id_log}`;
      link.download = row.nome;
      link.click();
    }
  };

  return (
    <div className="p-4 bg-card text-foreground rounded-2xl border border-border shadow-[0_0_10px_rgba(0,0,0,0.05)] w-full min-h-64">
      <div className="flex">
        <button
          className={`px-4 py-2 text-sm font-bold text-foreground ${activeTab === "logs" ? "border-b-2 border-border" : ""
            }`}
          onClick={() => setActiveTab("logs")}
        >
          Consola de Logs
        </button>
        <button
          className={`px-4 py-2 text-sm font-bold text-foreground ${activeTab === "historico" ? "border-b-2 border-border" : ""
            }`}
          onClick={() => setActiveTab("historico")}
        >
          Histórico de Logs
        </button>
      </div>

      <div className="pt-2.5 px-2 py-2">
        {activeTab === "logs" ? (
          <div className="flex flex-col bg-background border rounded-md" style={{ height: "265px" }}>
            {/* Scroll fixo para logs */}
            <div className="overflow-y-auto px-2 pt-2" style={{ flexGrow: 1, minHeight: 0 }}>
              <ul className="flex flex-col-reverse gap-1 text-sm font-mono text-muted-foreground">
                {socketLogs.map((log, index) => (
                  <li key={index}>{log}</li>
                ))}
                <div ref={logsEndRef} />
              </ul>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const command = e.target.command.value.trim();

                if (!command) return;

                if (command === "/clear") {
                  setSocketLogs([]);
                } else if (command === "/help") {
                  setSocketLogs((prev) => [...prev, "Comandos disponíveis: /help e /clear"]);
                } else {
                  setSocketLogs((prev) => [...prev, `Comando desconhecido: ${command}`]);
                }

                e.target.reset();
              }}
              className="flex items-center gap-2 px-2 py-2"
            >
              <span className="text-sm font-mono text-muted-foreground">›</span>
              <input
                name="command"
                type="text"
                placeholder="Escreve um comando (ex: /help)"
                className="flex-1 text-sm bg-transparent border-b border-border px-1 py-0.5 focus:outline-none"
                autoComplete="off"
              />
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-1 gap-2 overflow-hidden">
                <DatePicker
                  date={selectedDate}
                  setDate={setSelectedDate}
                  className="w-full truncate"
                />

                <Button
                  onClick={() => setSelectedDate({ from: undefined, to: undefined })}
                  className="text-sm rounded-md whitespace-nowrap"
                  variant="outline"
                >
                  Limpar
                </Button>
              </div>

              <Button
                onClick={async () => {
                  try {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/log/logs/downloadAll`, {
                      method: "GET",
                      credentials: "include",
                    });

                    if (!response.ok) {
                      throw new Error("Erro ao descarregar ZIP");
                    }

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);

                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", "logs.zip");
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (error) {
                    console.error("❌ Erro ao fazer download dos logs:", error);
                    alert("Erro ao fazer download dos logs.");
                  }
                }}
                className="hidden sm:block text-sm whitespace-nowrap "
                variant="outline"
              >
                Baixar todos
              </Button>

            </div>

            {tableData.length > 0 ? (
              <DataTable
                data={tableData}
                columns={columns}
                searchField="nome"
                onAction={handleAction}
                actionsKey="actions"
                showSearch={false}
                showColumnFilters={false}
              />
            ) : (
              <p className="text-muted-foreground">Nenhum log encontrado para esta data.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
