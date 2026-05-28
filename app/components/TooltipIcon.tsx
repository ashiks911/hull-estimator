"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export type TooltipContent = {
  definition: string;
  formula: string;
  interpretation?: string;
};

export function TooltipIcon({ content }: { content: TooltipContent }) {
  const [open, setOpen] = useState(false);
  const [clickLocked, setClickLocked] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  function computePos() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 320;
    const top = rect.bottom + 6;
    const rawLeft = rect.left + rect.width / 2 - popoverWidth / 2;
    const left = Math.max(8, Math.min(rawLeft, window.innerWidth - popoverWidth - 8));
    setPos({ top, left });
  }

  function openPopover() {
    clearTimeout(closeTimer.current);
    computePos();
    setOpen(true);
  }

  function scheduleClose() {
    if (clickLocked) return;
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  function handleClick() {
    clearTimeout(closeTimer.current);
    if (clickLocked) {
      setClickLocked(false);
      setOpen(false);
    } else {
      setClickLocked(true);
      computePos();
      setOpen(true);
    }
  }

  function closeAll() {
    clearTimeout(closeTimer.current);
    setOpen(false);
    setClickLocked(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    function onPointerDown(e: PointerEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        closeAll();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="More information"
        aria-expanded={open}
        onClick={handleClick}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onFocus={openPopover}
        onBlur={(e) => {
          if (popoverRef.current?.contains(e.relatedTarget as Node)) return;
          scheduleClose();
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-[10px] font-semibold leading-none hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition-colors flex-shrink-0"
      >
        ?
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 50 }}
            onMouseEnter={() => clearTimeout(closeTimer.current)}
            onMouseLeave={scheduleClose}
            className="w-80 max-w-[calc(100vw-16px)] bg-white rounded-lg border border-gray-200 shadow-lg p-3.5 space-y-2"
          >
            <p className="text-sm text-gray-700 leading-snug">{content.definition}</p>
            <p className="text-xs font-mono text-gray-500 leading-snug">{content.formula}</p>
            {content.interpretation && (
              <p className="text-xs text-blue-600 leading-snug">{content.interpretation}</p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}
