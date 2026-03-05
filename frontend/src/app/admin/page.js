"use client";

import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ProtectedRoute from "../components/protectedRoute";
import LogConsole from "../components/LogConsole";
import DataTable from "../components/DataTable";
import CustomDialog from "../components/CustomDialog";
import DropdownSingle from "../components/select";
import StatisticsCards from "../components/StatisticsCards";

const API = process.env.NEXT_PUBLIC_API_URL;
const getSwal = () => import("sweetalert2").then((m) => m.default);

const DashboardPage = () => {
  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor", "Editor User", "Editor Role", "Editor Permission"]}>
      {(userRole) => <Dashboard userRole={userRole} />}
    </ProtectedRoute>
  );
};

function Dashboard({ userRole }) {
  const [users, setUsers] = useState([]);
  const [logFiles, setLogFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [roles, setRoles] = useState([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", role: "" });

  const isAdmin = userRole === "Admin";

  const userColumns = useMemo(
    () => [
      { accessorKey: "name", header: "Nome" },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        render: (value) => value?.name || "–",
      },
      {
        accessorKey: "status",
        header: "Status",
        render: (_value, row) => (row.active ? "Ativo" : "Bloqueado"),
      },
    ],
    []
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        const usersPromise = fetch(`${API}/user/list`, { signal: controller.signal });
        const rolesPromise = fetch(`${API}/user/roles`, { signal: controller.signal });
        const logsPromise = isAdmin
          ? fetch(`${API}/log/logs`, { signal: controller.signal })
          : Promise.resolve(null);

        const [usersResponse, rolesResponse, logsResponse] = await Promise.all([
          usersPromise,
          rolesPromise,
          logsPromise,
        ]);

        if (!usersResponse.ok) throw new Error("Erro ao buscar usuários");
        if (!rolesResponse.ok) throw new Error("Erro ao buscar roles");
        const usersData = await usersResponse.json();
        const usersWithActions = (usersData.data || []).map((user) => ({
          ...user,
          actions: ["Editar", user.active ? "Bloquear" : "Desbloquear", "Eliminar"],
        }));
        if (isMounted) setUsers(usersWithActions);

        if (isAdmin && logsResponse) {
          if (!logsResponse.ok) throw new Error("Erro ao buscar logs");
          const logsData = await logsResponse.json();
          if (isMounted) setLogFiles(logsData.data || []);
        }

        const rolesData = await rolesResponse.json();
        const formattedRoles = (rolesData.data || []).map((role) => ({
          label: role.name,
          value: role.name,
        }));
        if (isMounted) setRoles(formattedRoles);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("❌ Erro ao buscar dados:", err);
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isAdmin]);

  const updateUserRole = async (id_user, role) => {
    try {
      const response = await axios.patch(
        `${API}/user/update-role/${id_user}`,
        { role },
        { headers: { "Content-Type": "application/json" } }
      );
      return response.data;
    } catch (err) {
      console.error("❌ Erro ao atualizar a role:", err.response?.data || err.message);
      throw err;
    }
  };

  const toggleBlockUser = async (user) => {
    const endpoint = user.active ? "block" : "unblock";
    try {
      await axios.patch(`${API}/user/${endpoint}/${user.id_user}`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id_user === user.id_user
            ? {
              ...u,
              active: !u.active,
              actions: ["Editar", !u.active ? "Bloquear" : "Desbloquear", "Eliminar"],
            }
            : u
        )
      );
      const Swal = await getSwal();
      Swal.fire({
        title: "Sucesso!",
        text: "Estado do utilizador atualizado.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (err) {
      console.error("❌ Erro ao bloquear/desbloquear:", err.response?.data || err.message);
      const Swal = await getSwal();
      Swal.fire({
        title: "Erro",
        text: "Erro ao atualizar estado do utilizador.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const deleteUser = async (user) => {
    const Swal = await getSwal();
    const result = await Swal.fire({
      title: `Eliminar utilizador`,
      text: `Tem a certeza que deseja eliminar ${user.email}? Esta ação é irreversível.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#171717",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${API}/user/delete/${user.id_user}`);
      setUsers((prev) => prev.filter((u) => u.id_user !== user.id_user));
      Swal.fire({
        title: "Eliminado!",
        text: "O utilizador foi removido.",
        icon: "success",
        confirmButtonColor: "#171717",
      });
    } catch (err) {
      console.error("❌ Erro ao eliminar utilizador:", err.response?.data || err.message);
      Swal.fire({
        title: "Erro",
        text: "Erro ao tentar eliminar o utilizador.",
        icon: "error",
        confirmButtonColor: "#171717",
      });
    }
  };

  const handleUserAction = async (action, user) => {
    if (action === "Editar") {
      setSelectedUser(user);
      setNewRole(user.role?.name || "");
      setDialogOpen(true);
    } else if (action === "Bloquear" || action === "Desbloquear") {
      const Swal = await getSwal();
      const result = await Swal.fire({
        title: `${action} utilizador`,
        text: `Tens a certeza que queres ${action.toLowerCase()} ${user.email}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Sim, ${action.toLowerCase()}`,
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#171717",
        cancelButtonColor: "#6b7280",
      });

      if (result.isConfirmed) {
        toggleBlockUser(user);
      }
    } else if (action === "Eliminar") {
      deleteUser(user);
    }
  };

  if (loading) return <div className="p-6">A carregar...</div>;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex-1 p-4 sm:p-8 overflow-auto">
        <h1 className="text-xl font-semibold mb-8 sm:text-2xl text-center sm:text-left mt-1 sm:mt-0">
          Área de Administração
        </h1>

        {isAdmin && (
          <div className="mb-6">
            <StatisticsCards />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${!isAdmin ? "sm:col-span-2" : ""} min-w-0`}>
            <div className="p-6 bg-card text-card-foreground rounded-2xl border border-border shadow-sm">
              <h2 className="font-semibold mb-4">Contas</h2>
              <DataTable
                data={users}
                columns={userColumns}
                showInvite={true}
                searchFields={["name", "email"]}
                onView={(user) => {
                  setSelectedUser(user);
                  setNewRole(user.role?.name || "");
                  setDialogOpen(true);
                }}
                searchPlaceholder="Pesquisar por email ou nome..."
                onAction={handleUserAction}
                onInvite={() => setInviteDialogOpen(true)}
              />
            </div>
          </div>

          {isAdmin && (
            <div className="min-w-0">
              <LogConsole logFiles={logFiles} />
            </div>
          )}
        </div>
      </div>

      <CustomDialog
        title={selectedUser ? `Editar role de ${selectedUser.email}` : ""}
        description="Seleciona a nova role:"
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedUser(null);
        }}
        onConfirm={async () => {
          const Swal = await getSwal();
          const result = await Swal.fire({
            title: "Confirmar alteração",
            text: "Tens a certeza que queres alterar a role deste utilizador?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sim, alterar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#171717",
            cancelButtonColor: "#6b7280",
          });

          if (!result.isConfirmed) return;

          try {
            await updateUserRole(selectedUser.id_user, newRole);
            setUsers((prev) =>
              prev.map((u) =>
                u.id_user === selectedUser.id_user ? { ...u, role: { name: newRole } } : u
              )
            );
            setDialogOpen(false);
            Swal.fire({
              title: "Atualizado!",
              text: "A role foi atualizada com sucesso.",
              icon: "success",
              confirmButtonColor: "#171717",
            });
          } catch (err) {
            Swal.fire({
              title: "Erro",
              text: "Erro ao atualizar a role. Verifica a consola.",
              icon: "error",
              confirmButtonColor: "#171717",
            });
          }
        }}
        cancelLabel="Cancelar"
        confirmLabel="Guardar"
      >
        <DropdownSingle
          label={newRole || "Seleciona uma role"}
          selectlabel="Roles"
          items={roles}
          onSelect={(value) => setNewRole(value)}
          className="mt-2"
        />
      </CustomDialog>

      <CustomDialog
        title="Convidar Utilizador"
        description="Preenche os dados do utilizador que queres convidar."
        open={inviteDialogOpen}
        onOpenChange={(open) => {
          setInviteDialogOpen(open);
          if (!open) setInviteData({ email: "", role: "" });
        }}
        onConfirm={async () => {
          const { email, role } = inviteData;

          if (!email || !role) {
            Swal.fire({
              title: "Campos obrigatórios",
              text: "Todos os campos são obrigatórios.",
              icon: "warning",
              confirmButtonColor: "#171717",
            });
            return;
          }

          const result = await Swal.fire({
            title: "Confirmar convite",
            text: `Tens a certeza que queres convidar ${email} com a role ${role}?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Sim, convidar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#171717",
            cancelButtonColor: "#6b7280",
          });

          if (!result.isConfirmed) return;

          try {
            await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/convite/user`, { email, role });
            Swal.fire({
              title: "Convidado!",
              text: "Utilizador convidado com sucesso!",
              icon: "success",
              confirmButtonColor: "#171717",
            });
            setInviteDialogOpen(false);
            setInviteData({ email: "", role: "" });
          } catch (err) {
            console.error("❌ Erro ao convidar utilizador:", err.response?.data || err.message);
            Swal.fire({
              title: "Erro",
              text: "Erro ao convidar utilizador.",
              icon: "error",
              confirmButtonColor: "#171717",
            });
          }
        }}
        cancelLabel="Cancelar"
        confirmLabel="Convidar"
      >
        <div className="flex flex-col gap-4 mt-2">
          <input
            type="email"
            placeholder="Email"
            value={inviteData.email}
            onChange={(e) => setInviteData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
          />
          <DropdownSingle
            label={inviteData.role || "Seleciona uma role"}
            selectlabel="Roles"
            items={roles}
            onSelect={(value) => setInviteData((prev) => ({ ...prev, role: value }))}
          />
        </div>
      </CustomDialog>
    </div>
  );
}

export default DashboardPage;
