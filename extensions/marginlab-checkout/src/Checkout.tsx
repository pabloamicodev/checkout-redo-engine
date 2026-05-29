// Entry point — Preact-based checkout extension (same API as checkout-trust-social-proof)
// @ts-nocheck
import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { MarginLabBlock } from "./MarginLabBlock.jsx";

export default function () {
  render(<MarginLabBlock />, document.body);
}
