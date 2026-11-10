import * as React from "react";
import type { ChatThreadTurn } from "./chat/chat-thread-turns";
import { useVirtualTurnListScroll } from "./chat/use-virtual-turn-list-scroll";
import {
  buildMountedSegments,
  computeMountedTurnIndices,
  findTurnIndexForMessage,
} from "./chat/virtual-turn-window";

export interface ChatThreadVirtualTurnListProps {
  turns: ChatThreadTurn[];
  isStreaming: boolean;
  /** Message to reveal (e.g. a search result): its turn is force-mounted. */
  targetMessageId?: string | null;
  /** Thread id used to save/restore the reading position across switches. */
  scrollStoreKey?: string | null;
  renderTurn: (turn: ChatThreadTurn, turnIndex: number) => React.ReactNode;
}

function TurnSpacer({ height }: { height: number }) {
  return (
    <div
      aria-hidden="true"
      data-testid="virtual-turn-spacer"
      style={{ height }}
      className="w-full shrink-0"
    />
  );
}

/**
 * Windowed turn list for the transcript (issue #11). Completed turns are
 * mounted only near the viewport; skipped turns become spacers sized from
 * measured or estimated heights (see useVirtualTurnListScroll). The
 * active streaming turn and a targeted (search) turn are always mounted,
 * so streaming output and search reveals never wait for a scroll.
 */
export function ChatThreadVirtualTurnList({
  turns,
  isStreaming,
  targetMessageId,
  scrollStoreKey,
  renderTurn,
}: ChatThreadVirtualTurnListProps) {
  const { rootRef, registerRow, metrics, layout } = useVirtualTurnListScroll(
    turns,
    scrollStoreKey,
  );

  const lastTurnIndex = turns.length - 1;
  const activeTurnIndex =
    lastTurnIndex >= 0 && (isStreaming || turns[lastTurnIndex]?.isStreaming)
      ? lastTurnIndex
      : -1;
  const targetTurnIndex = targetMessageId
    ? findTurnIndexForMessage(turns, targetMessageId)
    : -1;

  // Keep the targeted turn mounted after the panel clears the target:
  // scrollIntoView only lands if the turn stays in the tree.
  const [stickyTargetIndex, setStickyTargetIndex] = React.useState(-1);
  if (targetTurnIndex >= 0 && targetTurnIndex !== stickyTargetIndex) {
    setStickyTargetIndex(targetTurnIndex);
  }
  const forcedTurnIndex =
    targetTurnIndex >= 0 ? targetTurnIndex : stickyTargetIndex;

  const mountedIndices = computeMountedTurnIndices({
    turnCount: turns.length,
    layout,
    viewportTop: metrics?.top ?? null,
    viewportHeight: metrics?.height ?? 0,
    activeTurnIndex,
    forcedTurnIndex,
  });
  const { segments, trailingSpacer } = buildMountedSegments(
    mountedIndices,
    layout,
  );

  if (turns.length === 0) return null;

  return (
    <div
      ref={rootRef}
      data-testid="chat-virtual-turn-list"
      className="flex w-full flex-col"
    >
      {segments.map((segment) => (
        <React.Fragment
          key={turns[segment.startIndex]?.id ?? segment.startIndex}
        >
          {segment.spacerBefore > 0 ? (
            <TurnSpacer height={segment.spacerBefore} />
          ) : null}
          {turns
            .slice(segment.startIndex, segment.endIndex + 1)
            .map((turn, offset) => (
              <div
                key={turn.id}
                ref={registerRow(turn.id)}
                data-turn-id={turn.id}
                data-testid="chat-turn-row"
                className="flex w-full flex-col"
              >
                {renderTurn(turn, segment.startIndex + offset)}
              </div>
            ))}
        </React.Fragment>
      ))}
      {trailingSpacer > 0 ? <TurnSpacer height={trailingSpacer} /> : null}
    </div>
  );
}
