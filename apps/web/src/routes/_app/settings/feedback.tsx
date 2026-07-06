import { createFileRoute } from "@tanstack/react-router";
import { FeedbackPagePanel } from "@modules/settings/components/feedback";

export const Route = createFileRoute("/_app/settings/feedback")({
  component: FeedbackPagePanel,
});
