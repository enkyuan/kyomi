import { env } from "@config/env";
import { buildFeedCategoryLabelsSql } from "./category-labels-sql";

export { buildFeedCategoryLabelsSql, type CategoryClassifierReadMode } from "./category-labels-sql";

export const feedCategoryLabelsSql = buildFeedCategoryLabelsSql(env.CATEGORY_CLASSIFIER_READ_MODE);
