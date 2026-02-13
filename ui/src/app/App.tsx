import React, { useEffect } from "react";
import { StoreProvider, useAppDispatch } from "./state/store.tsx";
import { AppShell } from "./AppShell.tsx";
import { connectAndSubscribe, getConnectionState, ping } from "./api/bridge";

function AppBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch({ type: "ui/commandCenter", open: false });
    dispatch({ type: "inspector/close" });
    connectAndSubscribe(dispatch).catch(() => {
      // connection errors handled via state updates
    });

    let timer: number | null = null;
    const tick = async () => {
      try {
        const [state, pong] = await Promise.all([getConnectionState(), ping()]);
        dispatch({
          type: "connection/set",
          payload: {
            ...state,
            connected: Boolean(pong?.ok),
            socket_path: pong?.socket_path || state.socket_path,
            latency_ms: pong?.latency_ms ?? null,
            last_ok_ts_ms: pong?.ok ? Date.now() : state.last_ok_ts_ms,
          },
        });
      } catch {
        dispatch({
          type: "connection/set",
          payload: { connected: false },
        });
      }
    };
    timer = window.setInterval(tick, 3000);
    tick();

    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [dispatch]);

  return <AppShell />;
}

export function App() {
  return (
    <StoreProvider>
      <AppBootstrap />
    </StoreProvider>
  );
}
