import React, { useEffect, useMemo, useState } from "react";
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { Card } from "../components/Card";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import type { GraphEdge, GraphNode } from "../state/types";

type LayoutNode = GraphNode & { x: number; y: number };

type LayoutEdge = GraphEdge & { source: LayoutNode; target: LayoutNode };

export function GraphView() {
  const { graph } = useAppState();
  const dispatch = useAppDispatch();
  const [layoutNodes, setLayoutNodes] = useState<LayoutNode[]>([]);
  const [layoutEdges, setLayoutEdges] = useState<LayoutEdge[]>([]);

  const nodes = useMemo(() => graph.nodes.map((n) => ({ ...n })), [graph.nodes]);
  const edges = useMemo(() => graph.edges.map((e) => ({ ...e })), [graph.edges]);

  useEffect(() => {
    if (!nodes.length) {
      setLayoutNodes([]);
      setLayoutEdges([]);
      return;
    }
    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, x: 150, y: 120 }]));
    const links = edges
      .map((e) => {
        const source = nodeMap.get(String(e.source));
        const target = nodeMap.get(String(e.target));
        if (!source || !target) return null;
        return { ...e, source, target } as LayoutEdge;
      })
      .filter(Boolean) as LayoutEdge[];

    const sim = forceSimulation(Array.from(nodeMap.values()))
      .force("charge", forceManyBody().strength(-140))
      .force("link", forceLink(links).id((d: any) => d.id).distance(70))
      .force("center", forceCenter(260, 140));

    sim.on("tick", () => {
      setLayoutNodes([...Array.from(nodeMap.values())]);
      setLayoutEdges([...links]);
    });

    return () => {
      sim.stop();
    };
  }, [nodes, edges]);

  return (
    <Card title="Mind Graph" subtitle="Live graph snapshot">
      <svg className="yx-mind-graph" viewBox="0 0 520 280">
        {layoutEdges.map((edge) => (
          <line
            key={edge.id}
            x1={edge.source.x}
            y1={edge.source.y}
            x2={edge.target.x}
            y2={edge.target.y}
            stroke="rgba(120,150,190,.45)"
          />
        ))}
        {layoutNodes.map((node) => (
          <g
            key={node.id}
            onClick={() =>
              dispatch({
                type: "inspector/open",
                title: `node ${node.id}`,
                item: {
                  trace_id: `graph-${node.id}`,
                  name: "graph.node",
                  ts_ms: Date.now(),
                  ok: true,
                  request: { id: `graph-${node.id}`, ts_ms: Date.now(), name: "graph.node", args: { id: node.id } },
                  response: {
                    id: `graph-${node.id}`,
                    ts_ms: Date.now(),
                    name: "graph.node",
                    ok: true,
                    result: node,
                  },
                },
              })
            }
          >
            <circle cx={node.x} cy={node.y} r={8 + (node.score || 0) * 6} fill="rgba(70,140,210,.8)" />
            <text x={node.x + 10} y={node.y + 4} fill="#dbe9f5" fontSize="10">
              {node.label || node.id}
            </text>
          </g>
        ))}
      </svg>
      {layoutNodes.length === 0 ? <div className="yx-muted">No graph data yet.</div> : null}
    </Card>
  );
}
