// components/dashboard/canvas/WorkflowCanvas.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { WorkflowRun, StepLog, Incident } from "@/lib/types";
import { computeCanvasGraph, CanvasNodeData } from "./canvasUtils";
import { WorkflowNode } from "./WorkflowNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import { PlayIcon, RefreshCwIcon, PlusIcon } from "../Icons";
import { formatDuration, getRunStatusInfo } from "@/lib/labels";

interface WorkflowCanvasProps {
  run: WorkflowRun | null;
  steps: StepLog[];
  incident: Incident | null;
  loading?: boolean;
  onApproveFix?: (incidentId: string) => Promise<void>;
  onRejectFix?: (incidentId: string) => Promise<void>;
  onOpenTestLab?: () => void;
  onOpenSubmitLead?: () => void;
}

export function WorkflowCanvas({
  run,
  steps,
  incident,
  loading,
  onApproveFix,
  onRejectFix,
  onOpenTestLab,
  onOpenSubmitLead,
}: WorkflowCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [replayStepIndex, setReplayStepIndex] = useState<number | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  // Pan and Zoom transform state: single source of truth for both SVG and nodes
  const [transform, setTransform] = useState({ x: 40, y: 30, scale: 0.9 });
  const [isDragging, setIsDragging] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const isPointerDownRef = useRef(false);
  const hasMovedBeyondThresholdRef = useRef(false);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, initialX: 0, initialY: 0 });
  const activePointerIdRef = useRef<number | null>(null);

  // Compute graph based on real-time data, replay progress, or ghost structure
  const { nodes, edges, canvasWidth, canvasHeight, isGhostFlow } = useMemo(() => {
    return computeCanvasGraph(run, steps, incident, replayStepIndex);
  }, [run, steps, incident, replayStepIndex]);

  // Selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  const isDetailPanelOpen = Boolean(selectedNode);

  /**
   * Fit-to-View Algorithm:
   * - Compute bounds strictly from the node layout coordinates.
   * - Scale = min(containerWidth / contentWidth, containerHeight / contentHeight) with 48px padding,
   *   clamped to a max of 1.0 and a min of 0.5.
   * - Excludes the 360px docked detail panel when open, centering content in the visible area.
   */
  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || nodes.length === 0) return;

    const totalWidth = viewport.clientWidth;
    const totalHeight = viewport.clientHeight;
    if (totalWidth <= 0 || totalHeight <= 0) return;

    const panelWidth = isDetailPanelOpen ? 360 : 0;
    const availableWidth = Math.max(totalWidth - panelWidth, 240);
    const availableHeight = totalHeight;

    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));

    const contentWidth = Math.max(maxX - minX, 100);
    const contentHeight = Math.max(maxY - minY, 100);

    const padding = 48;
    const paddedWidth = contentWidth + padding * 2;
    const paddedHeight = contentHeight + padding * 2;

    const scaleX = availableWidth / paddedWidth;
    const scaleY = availableHeight / paddedHeight;
    const fitScale = Math.min(1.0, Math.max(0.5, Math.min(scaleX, scaleY)));

    const fitX = (availableWidth - contentWidth * fitScale) / 2 - minX * fitScale;
    const fitY = (availableHeight - contentHeight * fitScale) / 2 - minY * fitScale;

    setTransform({
      x: Math.round(fitX),
      y: Math.round(fitY),
      scale: fitScale,
    });
  }, [nodes, isDetailPanelOpen]);

  // Re-fit on run change, incident change, or detail panel toggle
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitToView();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [run?.id, incident?.id, nodes.length, isDetailPanelOpen, fitToView]);

  // ResizeObserver on the container to re-fit whenever container size changes
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => {
      fitToView();
    });

    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitToView]);

  // Default to selecting the failed node or decision node if awaiting approval
  useEffect(() => {
    if (incident) {
      if (incident.decision === "pending") {
        setSelectedNodeId("node_h_decide");
      } else {
        const failedNode = nodes.find((n) => n.stepName === incident.failedStep);
        if (failedNode) {
          setSelectedNodeId(failedNode.id);
        }
      }
    } else {
      setSelectedNodeId(null);
    }
  }, [run?.id, incident?.id, incident?.decision, nodes]);

  // Pointer event handlers for drag panning
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (
      target.closest("[data-node]") ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input")
    ) {
      return;
    }

    isPointerDownRef.current = true;
    hasMovedBeyondThresholdRef.current = false;
    activePointerIdRef.current = e.pointerId;

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      initialX: transform.x,
      initialY: transform.y,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;

    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    if (!hasMovedBeyondThresholdRef.current) {
      if (Math.hypot(dx, dy) >= 4) {
        hasMovedBeyondThresholdRef.current = true;
        setIsDragging(true);
      } else {
        return;
      }
    }

    setTransform((prev) => ({
      ...prev,
      x: dragStartRef.current.initialX + dx,
      y: dragStartRef.current.initialY + dy,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      setIsDragging(false);

      if (activePointerIdRef.current !== null) {
        try {
          e.currentTarget.releasePointerCapture(activePointerIdRef.current);
        } catch {}
        activePointerIdRef.current = null;
      }
    }
  };

  // Zoom centered on pointer via non-passive wheel listener
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = viewport.getBoundingClientRect();
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;

      setTransform((prev) => {
        const newScale = Math.min(1.5, Math.max(0.4, prev.scale * zoomFactor));
        const newX = pointerX - (pointerX - prev.x) * (newScale / prev.scale);
        const newY = pointerY - (pointerY - prev.y) * (newScale / prev.scale);
        return { x: newX, y: newY, scale: newScale };
      });
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  // Double-click empty canvas = fit to view
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest("[data-node]") &&
      !target.closest("button") &&
      !target.closest("a")
    ) {
      fitToView();
    }
  };

  // Replay Animation Engine (400ms per step)
  const handleStartReplay = () => {
    if (isReplaying || steps.length === 0) return;
    setIsReplaying(true);
    setReplayStepIndex(0);

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps.length) {
        clearInterval(interval);
        setIsReplaying(false);
        setReplayStepIndex(null);
      } else {
        setReplayStepIndex(currentStep);
      }
    }, 400);
  };

  // Run timing & status
  const runDurationMs = run?.finishedAt
    ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
    : undefined;
  const totalDuration = runDurationMs
    ? formatDuration(runDurationMs)
    : steps.length > 0
    ? formatDuration(steps.reduce((acc, s) => acc + (s.durationMs || 0), 0))
    : "—";

  const leadName = (run?.inputPayload?.name as string) || "Lead";
  const company = (run?.inputPayload?.company as string) || "";
  const statusInfo = run ? getRunStatusInfo(run.status) : null;
  const isInjectedFault = incident && Boolean(incident.errorContext?.injected || incident.errorContext?.chaosMode);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg)] relative">
      {/* 1. Apple Canvas Top Bar (h-11 apple-glass) */}
      <div className="h-11 border-b border-[var(--border)] apple-glass px-4.5 flex items-center justify-between shrink-0 select-none z-10 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          {run ? (
            <>
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#0071E3] to-[#5856D6] text-white flex items-center justify-center font-bold text-[11px] shadow-xs shrink-0">
                {leadName.charAt(0).toUpperCase()}
              </div>
              <span className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-tight truncate">
                {leadName}{company ? ` · ${company}` : ""}
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono px-2 py-0.5 rounded-md bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] hidden sm:inline">
                lead_to_crm
              </span>

              {statusInfo && (
                <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border shadow-xs ${statusInfo.badgeClass}`}>
                  {statusInfo.label}
                </span>
              )}

              {isInjectedFault && (
                <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-medium">
                  Injected Fault
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-primary)]">lead_to_crm workflow</span>
              <span>·</span>
              <span>No execution selected (showing ghost flow)</span>
            </div>
          )}
        </div>

        {/* Right side: Replay or Submit Test Lead */}
        <div className="flex items-center gap-3">
          {run ? (
            <>
              <div className="text-[11.5px] font-mono text-[var(--text-muted)] px-2.5 py-1 rounded-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.03] dark:border-white/[0.05]">
                Duration: <span className="text-[var(--text-primary)] font-semibold">{totalDuration}</span>
              </div>

              <button
                onClick={handleStartReplay}
                disabled={isReplaying || steps.length === 0}
                className="h-7 px-3 text-[11.5px] font-medium rounded-full bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-[var(--text-primary)] transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isReplaying ? (
                  <RefreshCwIcon className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                ) : (
                  <PlayIcon className="w-3.5 h-3.5 text-[var(--accent)]" />
                )}
                <span>{isReplaying ? "Replaying..." : "Replay"}</span>
              </button>
            </>
          ) : (
            <button
              onClick={onOpenSubmitLead}
              className="h-7 px-3.5 text-[11.5px] font-medium rounded-full bg-gradient-to-b from-[#0077ED] to-[#0066CC] hover:from-[#0082FF] hover:to-[#0070E0] text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Submit a test lead</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Canvas Grid Area + 360px Docked Overlay Detail Panel */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Outer Viewport for Canvas */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          style={{
            cursor: isDragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
            overflow: "hidden",
            position: "relative",
          }}
          className="flex-1 w-full h-full relative"
        >
          {/* Dot Grid Background (1px dots, 24px spacing, ~6% opacity) */}
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: "radial-gradient(var(--canvas-dots) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Canvas Pan/Zoom Wrapper: both SVG edges and nodes move together */}
          <div
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
              width: canvasWidth,
              height: canvasHeight,
              position: "absolute",
              top: 0,
              left: 0,
            }}
            className="z-10"
          >
            {/* SVG Edges Layer */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasWidth}
              height={canvasHeight}
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Standard pending arrow */}
                <marker
                  id="arrow-pending"
                  viewBox="0 0 6 6"
                  refX="5"
                  refY="3"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 5 3 L 0 6 z" className="fill-zinc-400 dark:fill-zinc-600" />
                </marker>

                {/* Traversed arrow (darker neutral) */}
                <marker
                  id="arrow-traversed"
                  viewBox="0 0 6 6"
                  refX="5"
                  refY="3"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 5 3 L 0 6 z" className="fill-zinc-600 dark:fill-zinc-400" />
                </marker>

                {/* Healing/Resume arrow (indigo) */}
                <marker
                  id="arrow-indigo"
                  viewBox="0 0 6 6"
                  refX="5"
                  refY="3"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 5 3 L 0 6 z" className="fill-indigo-500" />
                </marker>

                {/* Failed arrow (red) */}
                <marker
                  id="arrow-failed"
                  viewBox="0 0 6 6"
                  refX="5"
                  refY="3"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 5 3 L 0 6 z" className="fill-rose-500" />
                </marker>
              </defs>

              {/* Render Connectors (1.5px stroke width) */}
              {edges.map((edge) => {
                let strokeColor = "stroke-zinc-300 dark:stroke-zinc-700";
                let markerEnd = "url(#arrow-pending)";

                if (isGhostFlow) {
                  strokeColor = "stroke-zinc-300 dark:stroke-zinc-800 stroke-dasharray-[4,4]";
                  markerEnd = "url(#arrow-pending)";
                } else if (edge.status === "traversed") {
                  strokeColor = "stroke-zinc-600 dark:stroke-zinc-400";
                  markerEnd = "url(#arrow-traversed)";
                } else if (edge.status === "running") {
                  strokeColor = "stroke-indigo-500";
                  markerEnd = "url(#arrow-indigo)";
                } else if (edge.status === "failed") {
                  strokeColor = "stroke-rose-500";
                  markerEnd = "url(#arrow-failed)";
                } else if (edge.status === "resume" || edge.status === "healing") {
                  strokeColor = "stroke-indigo-500";
                  markerEnd = "url(#arrow-indigo)";
                }

                return (
                  <g key={edge.id}>
                    <path
                      d={edge.path}
                      fill="none"
                      className={`${strokeColor} transition-colors duration-200`}
                      strokeWidth="1.5"
                      markerEnd={markerEnd}
                    />

                    {/* Animated moving circle for running steps */}
                    {edge.status === "running" && (
                      <circle r="3.5" className="fill-indigo-500">
                        <animateMotion
                          path={edge.path}
                          dur="1.2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Orthogonal return edge label: Apple pill centered on the line */}
                    {edge.label && edge.labelX !== undefined && edge.labelY !== undefined && (
                      <g transform={`translate(${edge.labelX}, ${edge.labelY})`}>
                        <rect
                          x="-32"
                          y="-10"
                          width="64"
                          height="20"
                          rx="10"
                          className="fill-[var(--surface)] stroke-[var(--border)] shadow-xs"
                        />
                        <text
                          x="0"
                          y="4"
                          textAnchor="middle"
                          className="fill-[var(--accent)] font-sans text-[11px] font-semibold tracking-tight"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Nodes Layer */}
            {nodes.map((node) => (
              <WorkflowNode
                key={node.id}
                node={node}
                isSelected={node.id === selectedNodeId}
                onClick={() => setSelectedNodeId(node.id)}
              />
            ))}
          </div>

          {/* Bottom-Right Floating Apple Zoom Toolbar */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1 p-1 rounded-full apple-glass border border-[var(--border)] shadow-lg select-none text-[12px]">
            <button
              onClick={() => {
                setTransform((prev) => ({
                  ...prev,
                  scale: Math.min(1.5, prev.scale * 1.15),
                }));
              }}
              title="Zoom in"
              className="w-7 h-7 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[var(--text-secondary)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-[11px] text-[var(--text-muted)] px-1 min-w-[36px] text-center font-medium">
              {Math.round(transform.scale * 100)}%
            </span>

            <button
              onClick={() => {
                setTransform((prev) => ({
                  ...prev,
                  scale: Math.max(0.4, prev.scale / 1.15),
                }));
              }}
              title="Zoom out"
              className="w-7 h-7 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[var(--text-secondary)] flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            <div className="h-4 w-[1px] bg-[var(--border)] mx-0.5" />

            <button
              onClick={fitToView}
              title="Fit to view (or double-click canvas)"
              className="h-7 px-3 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-[var(--text-primary)] font-semibold transition-all text-[11.5px] cursor-pointer active:scale-95"
            >
              Fit
            </button>
          </div>
        </div>

        {/* 3. Node Detail 360px Overlay Docked to Right */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            run={run}
            onClose={() => setSelectedNodeId(null)}
            onApproveFix={onApproveFix}
            onRejectFix={onRejectFix}
          />
        )}
      </div>
    </div>
  );
}
