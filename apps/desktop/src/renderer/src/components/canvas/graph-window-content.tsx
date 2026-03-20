import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3-force";
import * as React from "react";
import { cn } from "@/lib/utils";

// Animation delay constants for staggered reveals
const STAGGER_BASE_MS = 30;

export interface GraphNode {
  id: string;
  label: string;
  group?: string;
  color?: string;
  radius?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  color?: string;
  label?: string;
}

type SimNode = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type SimLink = GraphLink & {
  source: string | SimNode;
  target: string | SimNode;
};

export interface GraphWindowContentProps {
  nodes: GraphNode[];
  links: GraphLink[];
  width?: number;
  height?: number;
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
}

function getNodePosition(node: SimNode, fallbackX: number, fallbackY: number) {
  return {
    x: Number.isFinite(node.x) ? (node.x ?? fallbackX) : fallbackX,
    y: Number.isFinite(node.y) ? (node.y ?? fallbackY) : fallbackY,
  };
}

function getLinkedNodeId(node: string | SimNode): string {
  return typeof node === "string" ? node : node.id;
}

export function GraphWindowContent({
  nodes,
  links,
  width = 960,
  height = 640,
  className,
  onNodeClick,
}: GraphWindowContentProps) {
  const [tick, setTick] = React.useState(0);
  const nodesRef = React.useRef<SimNode[]>([]);
  const linksRef = React.useRef<SimLink[]>([]);
  const simulationRef = React.useRef<ReturnType<
    typeof forceSimulation<SimNode>
  > | null>(null);
  const dragStateRef = React.useRef<{
    nodeId: string;
    pointerId: number;
  } | null>(null);

  React.useEffect(() => {
    if (nodes.length === 0) {
      nodesRef.current = [];
      linksRef.current = [];
      simulationRef.current?.stop();
      simulationRef.current = null;
      return;
    }

    const simNodes = nodes.map((node) => ({ ...node }));
    const simLinks = links.map((link) => ({ ...link }));

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody<SimNode>().strength(-240))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((node: SimNode) => node.id)
          .distance(110),
      )
      .force(
        "collide",
        forceCollide<SimNode>().radius(
          (node: SimNode) => (node.radius ?? 18) + 18,
        ),
      )
      .on("tick", () => {
        nodesRef.current = simNodes;
        linksRef.current = simLinks;
        setTick((value) => value + 1);
      });

    nodesRef.current = simNodes;
    linksRef.current = simLinks;
    simulationRef.current?.stop();
    simulationRef.current = simulation;

    return () => {
      simulation.stop();
      if (simulationRef.current === simulation) {
        simulationRef.current = null;
      }
    };
  }, [nodes, links, width, height]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const draggedNode = nodesRef.current.find(
        (node) => node.id === dragState.nodeId,
      );
      if (!draggedNode) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      draggedNode.fx = event.clientX - rect.left;
      draggedNode.fy = event.clientY - rect.top;
      simulationRef.current?.alphaTarget(0.3).restart();
      setTick((value) => value + 1);
    },
    [],
  );

  const handlePointerUp = React.useCallback(() => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }

    const draggedNode = nodesRef.current.find(
      (node) => node.id === dragState.nodeId,
    );
    if (draggedNode) {
      draggedNode.fx = null;
      draggedNode.fy = null;
    }

    dragStateRef.current = null;
    simulationRef.current?.alphaTarget(0);
  }, []);

  const renderedNodes = nodesRef.current;
  const renderedLinks = linksRef.current;

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-sm text-muted-foreground",
          // Window enter animation
          "animate-[window-enter_300ms_cubic-bezier(0.23,1,0.32,1)_forwards]",
          className,
        )}
      >
        No graph data yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-full w-full overflow-hidden bg-background",
        // Window enter animation - scale from 0.95 with translateY
        "animate-[window-enter_300ms_cubic-bezier(0.23,1,0.32,1)_forwards]",
        className
      )}
    >
      <svg
        key={tick}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        role="img"
        aria-label="Workspace graph"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <title>Workspace graph</title>
        <g>
          {renderedLinks.map((link, index) => {
            const source = renderedNodes.find(
              (node) => node.id === getLinkedNodeId(link.source),
            );
            const target = renderedNodes.find(
              (node) => node.id === getLinkedNodeId(link.target),
            );
            if (!source || !target) {
              return null;
            }

            const sourcePosition = getNodePosition(
              source,
              width / 2,
              height / 2,
            );
            const targetPosition = getNodePosition(
              target,
              width / 2,
              height / 2,
            );
            const labelX = (sourcePosition.x + targetPosition.x) / 2;
            const labelY = (sourcePosition.y + targetPosition.y) / 2;

            return (
              <g
                key={`${getLinkedNodeId(link.source)}-${getLinkedNodeId(link.target)}`}
                // Staggered reveal for links
                className="animate-[stagger-fade-in_200ms_cubic-bezier(0.23,1,0.32,1)_forwards]"
                style={{ animationDelay: `${STAGGER_BASE_MS * (index % 8)}ms` }}
              >
                <line
                  x1={sourcePosition.x}
                  y1={sourcePosition.y}
                  x2={targetPosition.x}
                  y2={targetPosition.y}
                  stroke={link.color ?? "#525252"}
                  strokeOpacity={0.85}
                  strokeWidth={2}
                />
                {link.label ? (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {link.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
        <g>
          {renderedNodes.map((node, index) => {
            const position = getNodePosition(node, width / 2, height / 2);
            const radius = node.radius ?? 18;

            return (
              <g
                key={node.id}
                transform={`translate(${position.x}, ${position.y})`}
                className={cn(
                  "cursor-pointer",
                  // Hover lift effect for interactive elements
                  "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  "hover:scale-[1.02]",
                  // Staggered reveal for nodes
                  "animate-[stagger-fade-in_200ms_cubic-bezier(0.23,1,0.32,1)_forwards]",
                  "motion-reduce:animate-none motion-reduce:opacity-100"
                )}
                style={{ animationDelay: `${STAGGER_BASE_MS * ((index % 8) + 1)}ms` }}
                onClick={() => onNodeClick?.(node)}
                onPointerDown={(event) => {
                  dragStateRef.current = {
                    nodeId: node.id,
                    pointerId: event.pointerId,
                  };
                  node.fx = position.x;
                  node.fy = position.y;
                  simulationRef.current?.alphaTarget(0.3).restart();
                }}
              >
                <circle
                  r={radius}
                  fill={node.color ?? "#3b82f6"}
                  fillOpacity={0.92}
                  stroke="#171717"
                  strokeWidth={2}
                  // Button press feedback on active
                  className="transition-transform duration-100 active:scale-[0.97]"
                />
                <text
                  y={radius + 14}
                  textAnchor="middle"
                  className="fill-foreground text-[11px]"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
