import { BadRequest, Forbidden, NotFound } from "@shared/effect/errors";

/** The feed row does not exist. */
export const feedNotFound = () =>
  new NotFound({ message: "Feed not found", code: "FEED_NOT_FOUND" });

/** The user has no subscription to the feed. */
export const subscriptionNotFound = () =>
  new NotFound({ message: "Subscription not found", code: "SUBSCRIPTION_NOT_FOUND" });

/** The user tried to act on a feed they are not subscribed to. */
export const notSubscribed = () =>
  new Forbidden({ message: "Not subscribed to this feed", code: "NOT_SUBSCRIBED" });

/** A bulk request carried no usable feed id. */
export const invalidFeedIds = () =>
  new BadRequest({ message: "feedIds must contain at least one id", code: "INVALID_FEED_IDS" });

/** A PUT/PATCH body named none of the fields the endpoint can change. */
export const emptyUpdate = () =>
  new BadRequest({ message: "No updatable fields provided", code: "EMPTY_UPDATE" });
