import { createContext } from "react";

type ArrivalTransition = <T>(
  work: () => Promise<T>,
  change: (result: T) => Promise<void>,
  at?: [number, number],
) => Promise<void>;

export const InboxArrivalTransition = createContext<{
  play: ArrivalTransition;
  setCaptureReady: (ready: boolean) => void;
}>({
  play: (work, change) => work().then(change),
  setCaptureReady: () => {},
});
