"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function slugifyRoom(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  const roomSlug = useMemo(() => slugifyRoom(room), [room]);
  const canEnter = name.trim().length >= 2 && roomSlug.length >= 2;

  const join = () => {
    if (!canEnter) return;
    router.push(`/room/${roomSlug}?name=${encodeURIComponent(name.trim())}`);
  };

  const shareLink =
    typeof window !== "undefined" && roomSlug
      ? `${window.location.origin}/room/${roomSlug}`
      : "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border p-6 shadow-sm bg-white">
        <h1 className="text-2xl font-semibold">PruebaCalls</h1>
        <p className="mt-1 text-sm opacity-80">
          Entra con un link, crea salas y haz videollamadas.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Tu nombre</label>
            <input
              className="mt-1 w-full rounded-xl border p-3"
              placeholder="Ej: Juan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Sala</label>
            <input
              className="mt-1 w-full rounded-xl border p-3"
              placeholder="Ej: equipo-ventas"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") join();
              }}
            />
            {room && (
              <p className="mt-2 text-xs opacity-70">
                Se usará como: <span className="font-mono">{roomSlug}</span>
              </p>
            )}
          </div>

          <button
            onClick={join}
            disabled={!canEnter}
            className="w-full rounded-xl bg-black text-white p-3 disabled:opacity-40"
          >
            Entrar a la sala
          </button>

          {roomSlug && (
            <div className="rounded-xl bg-gray-50 p-3 border">
              <p className="text-sm font-medium">Link para compartir</p>
              <p className="mt-1 text-xs font-mono break-all">{shareLink}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
