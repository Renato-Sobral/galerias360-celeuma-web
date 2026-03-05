"use client";

import ProtectedRoute from "../components/protectedRoute";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("../components/map"), { ssr: false });

export default function MapPage() {
    return (
        <div className="flex min-h-screen">
            <main className="flex-1 p-0 overflow-auto">
                <Map />
            </main>
        </div>
    );
}
