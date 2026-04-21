import * as React from "react";
import { ONBOARDING_KEY, WelcomeDialog } from "./welcome-dialog";

export type OnboardingGuardProps = {
  children?: React.ReactNode;
};

export function OnboardingGuard({
  children,
}: OnboardingGuardProps): React.ReactElement | null {
  const [shouldShow, setShouldShow] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    try {
      const value = globalThis.localStorage.getItem(ONBOARDING_KEY);
      setShouldShow(value !== "true");
    } catch {
      setShouldShow(false);
    }
  }, []);

  const handleComplete = React.useCallback(() => {
    setShouldShow(false);
  }, []);

  if (shouldShow === null) {
    return null;
  }

  if (shouldShow) {
    return <WelcomeDialog open onComplete={handleComplete} />;
  }

  return <>{children}</>;
}

export { ONBOARDING_KEY };
