/**
 * Public surface of the cache layer.
 *
 * Import from "@/lib/cache" rather than the individual modules.
 */

export {
  CACHE_ENABLED,
  CACHE_STRATEGIES,
  CACHE_VERBOSE,
  getCacheStrategy,
  getCacheTTL,
  isCacheEnabledFor,
  type CacheCategory,
  type CacheStrategy,
  type CacheStrategyName,
} from "./config";

export {
  CACHE_GROUPS,
  CACHE_NAMESPACE,
  cacheKey,
  checkinsCacheKey,
  filterSuffix,
  goalsCacheKey,
  groupIndexKey,
  notificationsCacheKey,
  oneOnOnesCacheKey,
  privateFeedbackCacheKey,
  publicFeedbackCacheKey,
  GOALS_KEY_PREFIX,
  ONE_ON_ONES_KEY_PREFIX,
  PUBLIC_FEEDBACK_KEY_PREFIX,
  type CacheGroup,
} from "./groups";

export {
  cached,
  deleteCached,
  deleteCachedInGroup,
  deleteCachedInGroupMatching,
  getCached,
  invalidateAll,
  invalidateGroup,
  invalidateGroups,
  setCached,
} from "./core";

export {
  invalidateCacheGroup,
  invalidateOwnerGoals,
  invalidateOneOnOneParticipants,
  invalidatePublicFeedback,
  invalidateTables,
  invalidateUserCheckins,
  invalidateUserNotifications,
  invalidateUserPrivateFeedback,
} from "./invalidate";

export {
  getCacheStats,
  getCacheSummary,
  resetCacheStats,
  type CacheGroupStats,
} from "./monitoring";

export {
  getCachedCandidates,
  getCachedDepartments,
  getCachedGoals,
  getCachedJob,
  getCachedJobs,
  getCachedMyCheckins,
  getCachedNotifications,
  getCachedOneOnOnes,
  getCachedPeople,
  getCachedPrivateFeedback,
  getCachedPublicFeedback,
  type CachedCandidate,
  type CachedNotification,
  type CachedUserRow,
  type FeedbackWithUsers,
} from "./queries";
