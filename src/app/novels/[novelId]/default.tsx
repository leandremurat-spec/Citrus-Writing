import { notFound } from "next/navigation";

/** Fallback for the implicit `children` slot when no route under the novel matches. */
export default function NovelDefault() {
  notFound();
}
