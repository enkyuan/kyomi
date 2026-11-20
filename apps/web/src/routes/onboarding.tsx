import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { getErrorStatus } from "@lib/status";
import { useInboxArrival } from "@modules/onboarding/hooks/use-inbox-arrival";
import {
  buildAuthEntryHref,
  resolveAuthReturnTo,
  validateAuthSearch,
} from "@modules/auth/redirect";
import { getOnboarding } from "@modules/onboarding/lib/api";
import { onboardingStepSchema } from "@modules/onboarding/lib/schema";
import { OnboardingPage } from "@modules/onboarding/page";
import { requireAuth } from "./-guards";

export const Route = createFileRoute("/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    ...validateAuthSearch(search),
    step: onboardingStepSchema.safeParse(search.step).data,
  }),
  loaderDeps: ({ search }) => ({ redirect: search.redirect }),
  beforeLoad: ({ context, search }) => {
    requireAuth(context.authState, resolveAuthReturnTo(search.redirect));
  },
  loader: async ({ deps }) => {
    const destination = resolveAuthReturnTo(deps.redirect);
    const state = await getOnboarding().catch((error) => {
      if (getErrorStatus(error) === 401) {
        throw redirect({ href: buildAuthEntryHref("/", destination), replace: true });
      }
      throw error;
    });
    if (state.status === "complete") throw redirect({ href: destination, replace: true });
    return state;
  },
  head: () => ({
    meta: [{ title: "Get started · Kyomi" }, { name: "robots", content: "noindex" }],
  }),
  component: OnboardingRoute,
});

function OnboardingRoute() {
  const router = useRouter();
  const { authState } = Route.useRouteContext();
  const state = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const destination = resolveAuthReturnTo(search.redirect);
  const openInbox = useInboxArrival(destination);

  return (
    <OnboardingPage
      key={authState.session?.user.id}
      initialState={state}
      requestedStep={search.step}
      onNavigate={(step) => void navigate({ search: (previous) => ({ ...previous, step }) })}
      onSessionExpired={() =>
        router.navigate({ href: buildAuthEntryHref("/", destination), replace: true })
      }
      onFinish={openInbox}
    />
  );
}
