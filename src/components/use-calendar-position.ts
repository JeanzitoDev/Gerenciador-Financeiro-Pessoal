"use client";
import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

// Keep a readable calendar width even when its input occupies half a form row.
// Position inside the dialog so its focus remains within the native modal.
export default function useCalendarPosition(
  open: boolean,
  anchor: RefObject<HTMLDivElement | null>,
  popup: RefObject<HTMLDivElement | null>,
  align: "left" | "right" = "left",
  preferredWidth: number | "anchor" = 320,
  preferredMaxHeight = Number.POSITIVE_INFINITY,
) {
  const [style, setStyle] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!anchor.current || !popup.current) return;
      const rect = anchor.current.getBoundingClientRect();
      if (!rect.width) return;
      const dialog = anchor.current.closest("dialog");
      const bounds = dialog?.getBoundingClientRect();
      const nested = anchor.current
        .closest(".calendar-popover")
        ?.getBoundingClientRect();
      const leftEdge = Math.max(
        16,
        (bounds?.left ?? 4) + 12,
        (nested?.left ?? 8) + 8,
      );
      const rightEdge = Math.min(
        window.innerWidth - 16,
        (bounds?.right ?? window.innerWidth - 4) - 12,
        (nested?.right ?? window.innerWidth - 8) - 8,
      );
      const desiredWidth =
        preferredWidth === "anchor"
          ? Math.max(rect.width, 196)
          : preferredWidth;
      const width = Math.min(desiredWidth, rightEdge - leftEdge);
      const left = Math.max(
        leftEdge,
        Math.min(
          align === "right" ? rect.right - width : rect.left,
          rightEdge - width,
        ),
      );
      const topEdge = Math.max(
        16,
        dialog?.querySelector(".dialog-head")?.getBoundingClientRect().bottom ??
          bounds?.top ??
          16,
        (nested?.top ?? 0) + 16,
      );
      const bottomEdge = Math.min(
        window.innerHeight - 16,
        dialog?.querySelector(".dialog-foot")?.getBoundingClientRect().top ??
          bounds?.bottom ??
          window.innerHeight - 16,
        (nested?.bottom ?? window.innerHeight) - 16,
      );
      const below = Math.max(0, bottomEdge - rect.bottom - 8);
      const above = Math.max(0, rect.top - topEdge - 8);
      const useAbove =
        below < Math.min(popup.current.scrollHeight, preferredMaxHeight) &&
        above > below;
      setStyle({
        width,
        left: left - rect.left,
        right: "auto",
        top: useAbove ? "auto" : "calc(100% + 8px)",
        bottom: useAbove ? "calc(100% + 8px)" : "auto",
        maxHeight: Math.min(useAbove ? above : below, preferredMaxHeight),
      });
    };
    position();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(position);
    if (popup.current) observer?.observe(popup.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, anchor, popup, align, preferredWidth, preferredMaxHeight]);
  return style;
}
