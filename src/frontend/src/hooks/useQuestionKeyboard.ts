import { useEffect, useRef, useCallback, useState } from "react";

export type QuestionType = "multiple-choice" | "true-false";

interface UseQuestionKeyboardOptions {
  questionType: QuestionType;
  optionCount: number;
  enabled: boolean;
  onSelect: (index: number) => void;
  questionId?: string;
}

interface KeyboardState {
  activeKey: string | null;
  keyboardHints: string[];
}

const MC_KEYS = ["1", "2", "3", "4"];
const TF_KEYS = ["Y", "N"];

export function useQuestionKeyboard({
  questionType,
  optionCount,
  enabled,
  onSelect,
  questionId,
}: UseQuestionKeyboardOptions): KeyboardState {
  const pressedKeys = useRef<Set<string>>(new Set());
  const submittedRef = useRef(false);
  const lastQuestionIdRef = useRef<string | undefined>(questionId);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Reset submitted flag when question changes
  useEffect(() => {
    if (questionId !== lastQuestionIdRef.current) {
      submittedRef.current = false;
      lastQuestionIdRef.current = questionId;
    }
  }, [questionId]);

  // Reset submitted flag when enabled changes from false to true
  useEffect(() => {
    if (enabled) {
      submittedRef.current = false;
    }
  }, [enabled]);

  const getKeyMapping = useCallback(
    (key: string): number | null => {
      const upperKey = key.toUpperCase();
      const keys = questionType === "true-false" ? TF_KEYS : MC_KEYS;

      const index = keys.indexOf(upperKey);
      if (index === -1 || index >= optionCount) return null;

      return index;
    },
    [questionType, optionCount],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if disabled, already submitted, or has modifiers
      if (!enabled || submittedRef.current || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const key = event.key.toUpperCase();

      // Check if this is a valid answer key
      const index = getKeyMapping(key);
      if (index === null) return;

      // Layer 1: Prevent key-repeat events
      if (pressedKeys.current.has(key)) {
        event.preventDefault();
        return;
      }

      // Mark key as pressed and set as active
      pressedKeys.current.add(key);
      setActiveKey(key);

      // Layer 2: Set submitted flag (persists until question changes)
      submittedRef.current = true;

      // Prevent default behavior
      event.preventDefault();

      // Call the selection callback
      onSelect(index);
    },
    [enabled, getKeyMapping, onSelect],
  );

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.toUpperCase();
    pressedKeys.current.delete(key);
    setActiveKey((current) => (current === key ? null : current));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Copy to local variable to satisfy react-hooks/exhaustive-deps
      const keys = pressedKeys.current;
      keys.clear();
      setActiveKey(null);
    };
  }, [enabled, handleKeyDown, handleKeyUp]);

  const keyboardHints = questionType === "true-false" 
    ? TF_KEYS.slice(0, optionCount) 
    : MC_KEYS.slice(0, optionCount);

  return {
    activeKey,
    keyboardHints,
  };
}
