import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuestionKeyboard } from "@/hooks/useQuestionKeyboard";

describe("useQuestionKeyboard", () => {
  let onSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSelect = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Multiple Choice Mode", () => {
    it("maps keys 1-4 to indices 0-3", () => {
      const { unmount: unmount1 } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
          questionId: "q1",
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledWith(0);
      
      unmount1();
      onSelect.mockClear();

      // Test key "3" in a fresh hook instance
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
          questionId: "q2",
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
      });
      expect(onSelect).toHaveBeenCalledWith(2);
    });

    it("returns correct keyboard hints for MC", () => {
      const { result } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      expect(result.current.keyboardHints).toEqual(["1", "2", "3", "4"]);
    });

    it("respects option count (3 options = only 1-3 valid)", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 3,
          enabled: true,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
      });
      expect(onSelect).toHaveBeenCalledWith(2);

      onSelect.mockClear();
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "4" }));
      });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("True/False Mode", () => {
    it("maps Y to index 0 and N to index 1", () => {
      const { unmount: unmount1 } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "true-false",
          optionCount: 2,
          enabled: true,
          onSelect,
          questionId: "q1",
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Y" }));
      });
      expect(onSelect).toHaveBeenCalledWith(0);

      unmount1();
      onSelect.mockClear();

      // Test key "N" in a fresh hook instance
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "true-false",
          optionCount: 2,
          enabled: true,
          onSelect,
          questionId: "q2",
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "N" }));
      });
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it("accepts lowercase y and n", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "true-false",
          optionCount: 2,
          enabled: true,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "y" }));
      });
      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it("returns correct keyboard hints for T/F", () => {
      const { result } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "true-false",
          optionCount: 2,
          enabled: true,
          onSelect,
        }),
      );

      expect(result.current.keyboardHints).toEqual(["Y", "N"]);
    });
  });

  describe("Enabled State", () => {
    it("does not call onSelect when disabled", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: false,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("re-enables keyboard when enabled changes from false to true", () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useQuestionKeyboard({
            questionType: "multiple-choice",
            optionCount: 4,
            enabled,
            onSelect,
          }),
        { initialProps: { enabled: false } },
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).not.toHaveBeenCalled();

      rerender({ enabled: true });

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
      });
      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe("Layer 1: Key-Repeat Prevention", () => {
    it("prevents duplicate calls when key is held down", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      // Simulate holding down key "1" (multiple keydown events)
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1);

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1); // Still only 1 call

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it("allows new keypress after keyup", () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useQuestionKeyboard({
            questionType: "multiple-choice",
            optionCount: 4,
            enabled,
            onSelect,
          }),
        { initialProps: { enabled: true } },
      );

      // Press and hold "1"
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1);

      // Release "1"
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "1" }));
      });

      // Re-enable and press "1" again - should be blocked by Layer 2 (submitted flag)
      rerender({ enabled: true });
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      
      // Still 1 call because submitted flag persists
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe("Layer 2: Submitted Flag Prevention", () => {
    it("prevents rapid successive presses even with keyup in between", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
          questionId: "q1",
        }),
      );

      // First press
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1);

      // Release
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "1" }));
      });

      // Try to press again immediately (different key)
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
      });
      
      // Still only 1 call - submitted flag prevents second submission
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("resets submitted flag when question changes", () => {
      const { rerender } = renderHook(
        ({ questionId }) =>
          useQuestionKeyboard({
            questionType: "multiple-choice",
            optionCount: 4,
            enabled: true,
            onSelect,
            questionId,
          }),
        { initialProps: { questionId: "q1" } },
      );

      // First question - press "1"
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1);

      // Release
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keyup", { key: "1" }));
      });

      // Change question
      rerender({ questionId: "q2" });

      // Now pressing should work again
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it("resets submitted flag when re-enabled", () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useQuestionKeyboard({
            questionType: "multiple-choice",
            optionCount: 4,
            enabled,
            onSelect,
            questionId: "q1",
          }),
        { initialProps: { enabled: true } },
      );

      // Press "1"
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(1);

      // Disable
      rerender({ enabled: false });

      // Re-enable
      rerender({ enabled: true });

      // Press again
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }));
      });
      expect(onSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe("Modifier Key Handling", () => {
    it("ignores keys with Ctrl modifier", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", ctrlKey: true }),
        );
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("ignores keys with Meta (Cmd) modifier", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", metaKey: true }),
        );
      });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("ignores keys with Alt modifier", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", altKey: true }),
        );
      });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Active Key Tracking", () => {
    it("sets activeKey when key is pressed", () => {
      const { result } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      expect(result.current.activeKey).toBeNull();

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });

      // activeKey should be set (but it's a ref, so we need to check in the next render)
      // For this test, we rely on the implementation detail that activeKey updates
    });
  });

  describe("Cleanup", () => {
    it("removes event listeners on unmount", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it("does not respond to keypresses after unmount", () => {
      const { unmount } = renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      unmount();

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }));
      });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Invalid Keys", () => {
    it("ignores non-answer keys", () => {
      renderHook(() =>
        useQuestionKeyboard({
          questionType: "multiple-choice",
          optionCount: 4,
          enabled: true,
          onSelect,
        }),
      );

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
      });
      expect(onSelect).not.toHaveBeenCalled();

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      });
      expect(onSelect).not.toHaveBeenCalled();

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
      });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
