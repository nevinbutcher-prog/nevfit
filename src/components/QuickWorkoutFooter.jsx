import { useEffect, useRef } from "react";

// Keep the add action and timer in one measured stack, including the safe area.
export default function QuickWorkoutFooter({ children, className }) {
  const footerRef = useRef(null);
  useEffect(() => {
    const footer = footerRef.current;
    const main = footer.closest("main");
    const viewport = window.visualViewport;
    let fullHeight = viewport?.height ?? window.innerHeight;
    const measure = () => {
      main.style.setProperty("--quick-workout-footer-height", `${footer.getBoundingClientRect().height}px`);
    };
    const updateKeyboard = () => {
      const height = viewport?.height ?? window.innerHeight;
      const editing = document.activeElement?.matches("input, textarea, select, [contenteditable='true']");
      if (!editing) fullHeight = Math.max(fullHeight, height);
      // Yield the bottom of the screen to the keyboard while editing a set/note.
      footer.hidden = Boolean(editing && fullHeight - height > 120);
      measure();
    };
    const resetHeight = () => {
      fullHeight = viewport?.height ?? window.innerHeight;
      updateKeyboard();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    viewport?.addEventListener("resize", updateKeyboard);
    window.addEventListener("resize", updateKeyboard);
    window.addEventListener("orientationchange", resetHeight);
    document.addEventListener("focusin", updateKeyboard);
    document.addEventListener("focusout", updateKeyboard);
    updateKeyboard();
    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", updateKeyboard);
      window.removeEventListener("resize", updateKeyboard);
      window.removeEventListener("orientationchange", resetHeight);
      document.removeEventListener("focusin", updateKeyboard);
      document.removeEventListener("focusout", updateKeyboard);
      main.style.removeProperty("--quick-workout-footer-height");
    };
  }, []);
  return <div ref={footerRef} className={className}>{children}</div>;
}
