"use client";

import Sidebar from "../../../components/sidebar";
import ProtectedRoute from "../../../components/protectedRoute";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../../../components/map"), { ssr: false });

export default function CreatePoint() {
    return (
        <ProtectedRoute rolesRequired={"Admin"}>
            <div className="flex min-h-screen">
                <div className="w-80 bg-gray-800 text-white">
                    <Sidebar />
                </div>
                <main className="flex-1 p-0 overflow-auto">
                <Map/>
                </main>
            </div>
        </ProtectedRoute>
    );
}
