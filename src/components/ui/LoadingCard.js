/**
 * LoadingCard UI wrapper
 * Re-exports the shared loading card component for UI imports.
 */

import { LoadingCard as BaseLoadingCard } from '@/components/loading/loading-card';

export default function LoadingCard(props) {
  return <BaseLoadingCard {...props} />;
}

export { BaseLoadingCard as LoadingCard };
