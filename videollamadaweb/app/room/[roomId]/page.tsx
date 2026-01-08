"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";

import "@livekit/components-styles";

type TokenResponse = {
  token: string;
  url: string;
};

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();

  const roomId = params.roomId;
  const name = (searchParams.get("name") || "").trim();

  const tokenEndpoint =
    process.env.NEXT_PUBLIC_TOKEN_ENDPOINT || "http://localhost:7000/livekit-token";

  const [data, setData] = useState<TokenResponse | null>(null);
  const [err, setErr] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const identity = useMemo(() => {
    const base = name || "guest";
    const suffix = Math.random().toString(16).slice(2, 8);
    return `${base}-${suffix}`;
  }, [name]);

  useEffect(() => {
    if (!name) {
      router.replace(`/`);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setErr("");
        setStatus("Generando token...");
        setData(null);

        const res = await fetch(tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, identity }),
        });

        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Token error (${res.status}): ${t}`);
        }

        const json = (await res.json()) as TokenResponse;

        if (!json?.token || !json?.url) {
          throw new Error("Respuesta inválida del server (falta token o url)");
        }

        // Debug útil
        console.log("✅ Token recibido. Conectando a:", json.url);
        setStatus(`Token OK. Conectando a ${json.url} ...`);

        if (!cancelled) setData(json);
      } catch (e: any) {
        const msg = e?.message || "Error desconocido";
        console.error("❌ Error obteniendo token:", e);
        if (!cancelled) {
          setErr(msg);
          setStatus("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, identity, name, router, tokenEndpoint]);

  if (!name) return null;

  if (err) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl border p-6 max-w-xl w-full">
          <h2 className="text-lg font-semibold">No se pudo entrar a la sala</h2>
          <p className="mt-2 text-sm font-mono whitespace-pre-wrap">{err}</p>

          <div className="mt-4 flex gap-2">
            <button
              className="rounded-xl bg-black text-white px-4 py-2"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
            <button
              className="rounded-xl border px-4 py-2"
              onClick={() => router.push("/")}
            >
              Volver al lobby
            </button>
          </div>

          <p className="mt-4 text-sm opacity-70">
            Tip: asegúrate de que el backend esté corriendo en{" "}
            <span className="font-mono">http://localhost:7000</span>
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl border p-6 max-w-md w-full">
          <p className="text-sm opacity-80">{status || "Preparando..."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Barra superior simple */}
      <div className="absolute top-3 left-3 z-50 rounded-xl border bg-white/80 backdrop-blur px-3 py-2 text-sm">
        <div>
          Sala: <span className="font-mono">{roomId}</span>
        </div>
        <div className="opacity-70">
          Usuario: <span className="font-mono">{identity}</span>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            className="rounded-lg border px-2 py-1"
            onClick={() =>
              navigator.clipboard.writeText(window.location.href.split("?")[0])
            }
          >
            Copiar link
          </button>

          <button
            className="rounded-lg bg-black text-white px-2 py-1"
            onClick={() => router.push("/")}
          >
            Salir
          </button>
        </div>
      </div>

      <LiveKitRoom
        token={data.token}
        serverUrl={data.url}
        connect
        video
        audio
        className="h-screen"
        // ✅ Debug: NO redirige, solo reporta
        onConnected={() => {
          console.log("✅ LiveKit conectado");
          setStatus("Conectado ✅");
        }}
        onDisconnected={(reason) => {
          console.log("⚠️ LiveKit disconnected:", reason);
          setStatus(`Desconectado: ${String(reason ?? "unknown")}`);
        }}
      >
        <RoomAudioRenderer />

        {/* UI completa y estable */}
        <VideoConference />

        {/* Debug abajo */}
        <div className="absolute bottom-3 left-3 z-50 rounded-xl border bg-white/80 backdrop-blur px-3 py-2 text-xs max-w-[80vw]">
          <div className="font-mono break-all">
            serverUrl: {data.url}
          </div>
          <div className="opacity-70">{status}</div>
        </div>
      </LiveKitRoom>
    </main>
  );
}
