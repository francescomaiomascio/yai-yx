import React from "react";
import { Card } from "../components/Card";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import { executeCommand } from "../core/commands";

export function LawView() {
  const { commandHistory } = useAppState();
  const dispatch = useAppDispatch();
  const last = commandHistory.find((item) => item.name === "law.snapshot");

  const runSnapshot = async () => {
    const res = await executeCommand(dispatch, "law.snapshot");
    if (!res.ok) return;
  };

  return (
    <Card title="Law Snapshot" subtitle="TLC-aligned snapshot view">
      <button type="button" onClick={runSnapshot}>
        Run law.snapshot
      </button>
      <pre className="yx-shell-output">
        {last?.response?.result ? JSON.stringify(last.response.result, null, 2) : "No snapshot yet."}
      </pre>
    </Card>
  );
}
