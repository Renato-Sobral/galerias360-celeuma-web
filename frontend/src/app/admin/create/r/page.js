"use client";

import ProtectedRoute from "../../../components/protectedRoute";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../../../components/map"), { ssr: false });

export default function CreatePoint() {
    return (
        <ProtectedRoute rolesRequired={"Admin"}>
            <div className="min-h-screen bg-background text-foreground">
                <main className="min-h-screen overflow-auto">
                    <Map />
                </main>
            </div>
        </ProtectedRoute>
    );
}
