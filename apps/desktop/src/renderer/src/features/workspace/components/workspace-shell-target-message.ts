import * as React from "react";

export function useWorkspaceShellTargetMessage() {
  const [targetMessageId, setTargetMessageId] = React.useState<string | null>(
    null,
  );

  const handleTargetMessageNavigated = React.useCallback(
    (messageId: string) => {
      setTargetMessageId((currentMessageId) =>
        currentMessageId === messageId ? null : currentMessageId,
      );
    },
    [],
  );

  return {
    targetMessageId,
    setTargetMessageId,
    handleTargetMessageNavigated,
  };
}
