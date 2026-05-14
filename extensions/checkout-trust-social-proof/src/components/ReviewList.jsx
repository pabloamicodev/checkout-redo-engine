import "@shopify/ui-extensions/preact";
import { ReviewCard } from "./ReviewCard.jsx";
import { REVIEWS } from "../data/reviews.js";


export function ReviewList() {
  const columns = REVIEWS.map(() => "260px").join(" ");

  return (
    <s-scroll-box overflow="hidden auto">
      <s-grid gridTemplateColumns={columns} gap="small">
        {REVIEWS.map((review) => (
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
