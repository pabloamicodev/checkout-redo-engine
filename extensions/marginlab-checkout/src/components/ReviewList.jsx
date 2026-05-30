// @ts-nocheck
import "@shopify/ui-extensions/preact";
import { ReviewCard } from "./ReviewCard.jsx";

export function ReviewList({ reviews }) {
  const columns = reviews.map(() => "260px").join(" ");
  return (
    <s-scroll-box overflow="hidden auto">
      <s-grid gridTemplateColumns={columns} gap="small">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            quote={review.quote}
            name={review.name}
            label={review.label}
            rating={review.rating}
          />
        ))}
      </s-grid>
    </s-scroll-box>
  );
}
